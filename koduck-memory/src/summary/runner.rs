use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tokio::sync::Semaphore;
use tracing::{info, instrument, warn};
use uuid::Uuid;

use crate::config::{RetrySection, SummarySection};
use crate::facts::{InsertMemoryFact, MemoryFact, MemoryFactRepository};
use crate::index::{InsertMemoryIndexRecord, MemoryIndexRepository};
use crate::memory::MemoryEntryRepository;
use crate::reliability::{TaskAttemptRepository, with_retry};
use crate::retrieve::domain_class;
use crate::session::SessionRepository;
use crate::store::ObjectStoreClient;
use crate::summary::{InsertMemorySummary, MemorySummary, MemorySummaryRepository};
use crate::Result;

const DEFAULT_STRATEGY: &str = "session-rollup";
const MAX_SUMMARY_CHARS: usize = 1_200;
const MAX_FACT_CHARS: usize = 220;
const MAX_FACTS_PER_RUN: usize = 8;
const MAX_PERSONS_PER_RUN: usize = 6;

#[derive(Debug, Clone)]
pub struct SummaryJob {
    pub tenant_id: String,
    pub session_id: Uuid,
    pub strategy: String,
    pub request_id: String,
}

impl SummaryJob {
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        strategy: impl Into<String>,
        request_id: impl Into<String>,
    ) -> Self {
        Self {
            tenant_id: tenant_id.into(),
            session_id,
            strategy: normalize_strategy(strategy.into()),
            request_id: request_id.into(),
        }
    }
}

#[derive(Clone)]
pub struct SummaryTaskRunner {
    entry_repo: MemoryEntryRepository,
    session_repo: SessionRepository,
    summary_repo: MemorySummaryRepository,
    fact_repo: MemoryFactRepository,
    attempt_repo: TaskAttemptRepository,
    index_repo: MemoryIndexRepository,
    object_store: Option<ObjectStoreClient>,
    retry_config: RetrySection,
    summary_config: SummarySection,
    llm_gate: Arc<Semaphore>,
}

impl SummaryTaskRunner {
    pub fn new(
        pool: &PgPool,
        object_store: Option<ObjectStoreClient>,
        summary_config: SummarySection,
        retry_config: RetrySection,
    ) -> Self {
        Self {
            entry_repo: MemoryEntryRepository::new(pool),
            session_repo: SessionRepository::new(pool),
            summary_repo: MemorySummaryRepository::new(pool),
            fact_repo: MemoryFactRepository::new(pool),
            attempt_repo: TaskAttemptRepository::new(pool),
            index_repo: MemoryIndexRepository::new(pool),
            object_store,
            retry_config,
            llm_gate: Arc::new(Semaphore::new(summary_config.llm_max_concurrency.max(1))),
            summary_config,
        }
    }

    #[instrument(skip(self), fields(tenant_id = %job.tenant_id, session_id = %job.session_id, strategy = %job.strategy, request_id = %job.request_id))]
    pub async fn run(&self, job: SummaryJob) -> Result<MemorySummary> {
        let materialized = with_retry(
            "summary_materialize",
            &job.tenant_id,
            job.session_id,
            &job.request_id,
            &self.attempt_repo,
            &self.retry_config,
            || {
                let runner = self.clone();
                let job = job.clone();
                async move { runner.materialize_summary(job).await }
            },
        )
        .await?;

        if let Err(error) = with_retry(
            "summary_index_refresh",
            &materialized.stored_summary.tenant_id,
            materialized.stored_summary.session_id,
            &materialized.request_id,
            &self.attempt_repo,
            &self.retry_config,
            || {
                let runner = self.clone();
                let materialized = materialized.clone();
                async move { runner.refresh_summary_index(&materialized).await }
            },
        )
        .await
        {
            warn!(
                error = %error,
                session_id = %materialized.stored_summary.session_id,
                "summary index refresh failed after all retries"
            );
        }

        if materialized.has_fact_candidates() {
            if let Err(error) = with_retry(
                "summary_facts_extract",
                &materialized.stored_summary.tenant_id,
                materialized.stored_summary.session_id,
                &materialized.request_id,
                &self.attempt_repo,
                &self.retry_config,
                || {
                    let runner = self.clone();
                    let materialized = materialized.clone();
                    async move { runner.materialize_facts(&materialized).await }
                },
            )
            .await
            {
                warn!(
                    error = %error,
                    session_id = %materialized.stored_summary.session_id,
                    "fact extraction failed after all retries"
                );
            }
        }

        info!(
            summary_id = %materialized.stored_summary.id,
            version = materialized.stored_summary.version,
            domain_class = %materialized.stored_summary.domain_class,
            fact_count = materialized.fact_candidates.len(),
            "summary task completed"
        );

        Ok(materialized.stored_summary)
    }

    async fn materialize_summary(&self, job: SummaryJob) -> Result<SummaryMaterialization> {
        let mut entries = self
            .entry_repo
            .list_by_session(&job.tenant_id, job.session_id, None)
            .await?;
        entries.sort_by_key(|entry| entry.sequence_num);

        let session = self
            .session_repo
            .get_by_id(&job.tenant_id, job.session_id)
            .await?;

        let transcript = build_transcript_fragments(&entries, self.object_store.as_ref()).await;
        let inferred_domain_class = classify_domain_class(
            &transcript,
            session.as_ref().map(|s| s.title.as_str()),
            &self.summary_config,
            self.llm_gate.clone(),
        )
        .await;
        let summary_artifact = build_summary_artifact(
            &transcript,
            entries.len(),
            session.as_ref().map(|s| s.title.as_str()),
            &inferred_domain_class,
            &self.summary_config,
            self.llm_gate.clone(),
        )
        .await;
        let version = self.summary_repo.next_version(&job.tenant_id, job.session_id).await?;

        maybe_inject_test_failure(&job.strategy, &job.request_id, "summary_materialize")?;

        let insert_summary = InsertMemorySummary::new(
            job.tenant_id.clone(),
            job.session_id,
            inferred_domain_class.clone(),
            summary_artifact.summary,
            job.strategy.clone(),
            version,
        );
        let stored = self.summary_repo.insert(&insert_summary).await?;

        let fact_candidates = build_fact_candidates(
            &transcript,
            session.as_ref().map(|value| value.title.as_str()),
            &stored.domain_class,
            &self.summary_config,
            self.llm_gate.clone(),
        )
        .await;

        Ok(SummaryMaterialization {
            stored_summary: stored,
            summary_snippet: summary_artifact.snippet,
            fact_candidates,
            request_id: job.request_id,
            test_strategy: job.strategy,
        })
    }

    async fn refresh_summary_index(&self, materialized: &SummaryMaterialization) -> Result<()> {
        maybe_inject_test_failure(
            &materialized.test_strategy,
            &materialized.request_id,
            "summary_index_refresh",
        )?;

        let stored = &materialized.stored_summary;
        self.index_repo
            .delete_by_session(&stored.tenant_id, stored.session_id)
            .await?;
        let summary_uri = build_summary_uri(&stored.tenant_id, stored.session_id, stored.version);
        let index_record = InsertMemoryIndexRecord::new(
            stored.tenant_id.clone(),
            stored.session_id,
            "summary",
            stored.domain_class.clone(),
            stored.summary.clone(),
            summary_uri,
        )
        .with_snippet(materialized.summary_snippet.clone())
        .with_score_hint("0.95");
        self.index_repo.insert(&index_record).await?;
        Ok(())
    }

    async fn materialize_facts(
        &self,
        materialized: &SummaryMaterialization,
    ) -> Result<Vec<MemoryFact>> {
        maybe_inject_test_failure(
            &materialized.test_strategy,
            &materialized.request_id,
            "summary_facts_extract",
        )?;

        self.fact_repo
            .delete_by_session(
                &materialized.stored_summary.tenant_id,
                materialized.stored_summary.session_id,
            )
            .await?;

        let mut facts = Vec::with_capacity(materialized.fact_candidates.len());
        for candidate in &materialized.fact_candidates {
            let insert_fact = InsertMemoryFact::new(
                &materialized.stored_summary.tenant_id,
                materialized.stored_summary.session_id,
                candidate.fact_type.clone(),
                &materialized.stored_summary.domain_class,
                candidate.fact_text.clone(),
                candidate.confidence,
            );
            facts.push(self.fact_repo.insert(&insert_fact).await?);
        }
        Ok(facts)
    }
}

async fn build_transcript_fragments(
    entries: &[crate::memory::MemoryEntry],
    object_store: Option<&ObjectStoreClient>,
) -> Vec<String> {
    let mut fragments = Vec::new();

    for entry in entries {
        let maybe_content = match object_store {
            Some(client) => client
                .get_l0_entry(&entry.l0_uri)
                .await
                .ok()
                .map(|content| content.content),
            None => None,
        };

        let fragment = match maybe_content {
            Some(content) if !content.trim().is_empty() => {
                format!("{}: {}", entry.role, content.trim())
            }
            _ => format!("{} message #{}", entry.role, entry.sequence_num),
        };

        let normalized_fragment = truncate_text(&fragment, 800);
        fragments.push(normalized_fragment);
    }

    fragments
}

#[derive(Debug, Clone, PartialEq)]
struct FactCandidate {
    fact_type: String,
    fact_text: String,
    confidence: f64,
}

#[derive(Debug, Clone)]
struct SummaryMaterialization {
    stored_summary: MemorySummary,
    summary_snippet: String,
    fact_candidates: Vec<FactCandidate>,
    request_id: String,
    test_strategy: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ChatCompletionsResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Clone, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Debug, Clone, Deserialize)]
struct ChatMessage {
    content: String,
}

#[derive(Debug, Clone, Serialize)]
struct ChatCompletionsRequest<'a> {
    model: &'a str,
    temperature: f32,
    messages: Vec<PromptMessage<'a>>,
}

#[derive(Debug, Clone, Serialize)]
struct PromptMessage<'a> {
    role: &'a str,
    content: String,
}

#[derive(Debug, Clone, Deserialize)]
struct SummaryArtifact {
    summary: String,
    snippet: String,
}

#[derive(Debug, Clone, Deserialize)]
struct NerArtifact {
    persons: Vec<String>,
    domain_class: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct DomainClassArtifact {
    domain_class: String,
}

impl SummaryMaterialization {
    fn has_fact_candidates(&self) -> bool {
        !self.fact_candidates.is_empty()
    }
}

impl FactCandidate {
    fn new(
        fact_type: impl Into<String>,
        fact_text: impl Into<String>,
        confidence: f64,
    ) -> Option<Self> {
        let fact_text = truncate_text(&fact_text.into(), MAX_FACT_CHARS);
        if fact_text.is_empty() {
            return None;
        }

        Some(Self {
            fact_type: fact_type.into(),
            fact_text,
            confidence,
        })
    }
}

async fn build_summary_artifact(
    transcript: &[String],
    entry_count: usize,
    session_title: Option<&str>,
    inferred_domain_class: &str,
    summary_config: &SummarySection,
    llm_gate: Arc<Semaphore>,
) -> SummaryArtifact {
    if summary_config.llm_enabled {
        match generate_summary_via_llm(
            transcript,
            entry_count,
            session_title,
            inferred_domain_class,
            summary_config,
            llm_gate,
        )
        .await
        {
            Ok(Some(artifact)) => return artifact,
            Ok(None) => {}
            Err(error) => {
                warn!(error = %error, "summary llm generation failed, falling back to heuristic summary");
            }
        }
    }

    build_heuristic_summary_artifact(
        transcript,
        entry_count,
        session_title,
        inferred_domain_class,
    )
}

fn build_heuristic_summary_artifact(
    transcript: &[String],
    entry_count: usize,
    session_title: Option<&str>,
    inferred_domain_class: &str,
) -> SummaryArtifact {
    let title_prefix = session_title
        .filter(|title| !title.trim().is_empty())
        .map(|title| format!("Session '{title}'"))
        .unwrap_or_else(|| "Session".to_string());

    if transcript.is_empty() {
        let summary = format!(
            "{title_prefix} produced an asynchronous summary with {entry_count} stored messages. The dominant domain class is {inferred_domain_class}."
        );
        return SummaryArtifact {
            snippet: truncate_text(&summary, 96),
            summary,
        };
    }

    let joined = transcript.join(" | ");
    let summary = truncate_text(
        &format!(
            "{title_prefix} summary ({inferred_domain_class}, {entry_count} messages): {joined}"
        ),
        MAX_SUMMARY_CHARS,
    );
    let snippet = summary
        .split(['。', '.', '\n'])
        .find(|part| !part.trim().is_empty())
        .map(|part| truncate_text(part, 96))
        .unwrap_or_else(|| truncate_text(&summary, 96));
    SummaryArtifact { summary, snippet }
}

async fn generate_summary_via_llm(
    transcript: &[String],
    entry_count: usize,
    session_title: Option<&str>,
    inferred_domain_class: &str,
    summary_config: &SummarySection,
    llm_gate: Arc<Semaphore>,
) -> Result<Option<SummaryArtifact>> {
    if transcript.is_empty() || summary_config.llm_api_key.trim().is_empty() {
        return Ok(None);
    }

    let _permit = llm_gate.acquire_owned().await?;

    let client = Client::builder()
        .timeout(Duration::from_millis(summary_config.llm_timeout_ms))
        .build()?;
    let url = format!(
        "{}/chat/completions",
        summary_config.llm_base_url.trim_end_matches('/')
    );
    let session_title = session_title.unwrap_or("untitled");
    let transcript_text = transcript.join("\n");
    let request = ChatCompletionsRequest {
        model: &summary_config.llm_model,
        temperature: 0.2,
        messages: vec![
            PromptMessage {
                role: "system",
                content: "你是一个有帮助的 AI 助手，用50个以内的字简洁、准确、陈述的方式总结用户的问题。你必须只返回 JSON 格式数据，不要输出任何解释、markdown、代码块或多余文本。返回格式示例：{\"summary\":\"这里是总结\",\"snippet\":\"这里是短摘要\"}。summary 和 snippet 都用中文。".to_string(),
            },
            PromptMessage {
                role: "user",
                content: format!(
                    "session_title: {session_title}\ndomain_class_hint: {inferred_domain_class}\nentry_count: {entry_count}\ntranscript:\n{transcript_text}\n用50个以内的字、简洁准确陈述的方式总结上面的内容"
                ),
            },
        ],
    };

    let response = client
        .post(url)
        .bearer_auth(&summary_config.llm_api_key)
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("summary llm returned {status}: {body}");
    }

    let payload: ChatCompletionsResponse = response.json().await?;
    let content = payload
        .choices
        .first()
        .map(|choice| choice.message.content.trim().to_string())
        .filter(|text| !text.is_empty());

    let Some(content) = content else {
        return Ok(None);
    };

    let artifact = parse_summary_artifact(&content)?;
    Ok(Some(SummaryArtifact {
        summary: truncate_text(&artifact.summary, MAX_SUMMARY_CHARS),
        snippet: truncate_text(&artifact.snippet, 96),
    }))
}

fn parse_summary_artifact(content: &str) -> Result<SummaryArtifact> {
    let sanitized = strip_think_blocks(content);

    if let Ok(artifact) = serde_json::from_str::<SummaryArtifact>(&sanitized) {
        return Ok(artifact);
    }

    if let Some(candidate) = extract_last_json_object(&sanitized) {
        if let Ok(artifact) = serde_json::from_str::<SummaryArtifact>(candidate) {
            return Ok(artifact);
        }
    }

    anyhow::bail!(
        "summary llm did not return valid json; raw_content={}",
        truncate_text(content, 500)
    )
}

async fn classify_domain_class(
    transcript: &[String],
    session_title: Option<&str>,
    summary_config: &SummarySection,
    llm_gate: Arc<Semaphore>,
) -> String {
    if summary_config.llm_enabled {
        match generate_domain_class_via_llm(
            transcript,
            session_title,
            summary_config,
            llm_gate,
        )
        .await
        {
            Ok(Some(domain_class)) => return domain_class,
            Ok(None) => {}
            Err(error) => {
                warn!(error = %error, "domain class llm generation failed, falling back to heuristic classification");
            }
        }
    }

    infer_domain_class_heuristic(transcript, session_title)
}

fn infer_domain_class_heuristic(transcript: &[String], session_title: Option<&str>) -> String {
    let mut corpus = transcript.join(" ").to_lowercase();
    if let Some(title) = session_title {
        corpus.push(' ');
        corpus.push_str(&title.to_lowercase());
    }

    if [
        "task",
        "todo",
        "deadline",
        "follow-up",
        "fix",
        "implement",
        "任务",
        "待办",
        "修复",
        "实现",
    ]
    .iter()
    .any(|keyword| corpus.contains(keyword))
    {
        return domain_class::TASK.to_string();
    }

    if !transcript.is_empty()
        && transcript
            .iter()
            .all(|line| line.starts_with("system:") || line.starts_with("system "))
    {
        return domain_class::SYSTEM.to_string();
    }

    for (class_name, keywords) in [
        (
            domain_class::HISTORY,
            &[
                "历史", "朝代", "战争史", "古代", "近代史", "人物关系", "dynasty", "empire",
                "histor", "revolution", "warlord",
            ][..],
        ),
        (
            domain_class::POLITICS,
            &[
                "政治", "政党", "政府", "外交", "政策", "选举", "意识形态", "politic",
                "government", "election", "diplom",
            ][..],
        ),
        (
            domain_class::LITERATURE,
            &[
                "文学", "小说", "诗", "散文", "作者", "作品", "文学史", "literature",
                "novel", "poem", "poetry", "writer",
            ][..],
        ),
        (
            domain_class::PHYSICS,
            &[
                "物理", "力学", "量子", "相对论", "电磁", "热力学", "physics", "quantum",
                "relativity", "mechanics",
            ][..],
        ),
        (
            domain_class::MATHEMATICS,
            &[
                "数学", "代数", "几何", "微积分", "概率", "统计", "mathematics", "math",
                "algebra", "geometry", "calculus",
            ][..],
        ),
        (
            domain_class::CHEMISTRY,
            &[
                "化学", "分子", "原子", "反应", "有机", "无机", "chemistry", "chemical",
                "molecule", "compound",
            ][..],
        ),
        (
            domain_class::BIOLOGY,
            &[
                "生物", "细胞", "基因", "进化", "生态", "biology", "cell", "gene",
                "genetic", "evolution",
            ][..],
        ),
        (
            domain_class::COMPUTER_SCIENCE,
            &[
                "计算机", "算法", "数据结构", "编程", "代码", "软件", "computer science",
                "algorithm", "programming", "code", "software",
            ][..],
        ),
        (
            domain_class::TECHNOLOGY,
            &[
                "技术", "芯片", "互联网", "人工智能", "模型", "technology", "tech",
                "semiconductor", "ai", "llm",
            ][..],
        ),
        (
            domain_class::ENGINEERING,
            &[
                "工程", "土木", "机械", "电子工程", "控制", "engineering",
                "civil engineering", "mechanical", "electrical",
            ][..],
        ),
        (
            domain_class::FINANCE,
            &[
                "金融", "股票", "基金", "投资", "量化", "finance", "stock", "portfolio",
                "trading", "asset",
            ][..],
        ),
        (
            domain_class::ECONOMICS,
            &[
                "经济", "宏观", "通胀", "货币", "供需", "economics", "gdp", "inflation",
                "monetary", "microeconomics",
            ][..],
        ),
        (
            domain_class::BUSINESS,
            &[
                "商业", "公司", "市场", "战略", "运营", "business", "company",
                "marketing", "strategy", "operation",
            ][..],
        ),
        (
            domain_class::LAW,
            &[
                "法律", "法条", "判例", "诉讼", "合规", "law", "legal", "regulation",
                "court", "compliance",
            ][..],
        ),
        (
            domain_class::PHILOSOPHY,
            &[
                "哲学", "伦理", "形而上", "认识论", "philosophy", "ethics",
                "metaphysics", "epistemology",
            ][..],
        ),
        (
            domain_class::PSYCHOLOGY,
            &[
                "心理", "认知", "行为", "人格", "心理学", "psychology", "cognitive",
                "behavior", "personality",
            ][..],
        ),
        (
            domain_class::EDUCATION,
            &[
                "教育", "课程", "教学", "学习", "考试", "education", "teaching",
                "curriculum", "exam", "learning",
            ][..],
        ),
        (
            domain_class::MEDICINE,
            &[
                "医学", "疾病", "治疗", "药物", "诊断", "medicine", "medical",
                "disease", "treatment", "diagnosis",
            ][..],
        ),
        (
            domain_class::GEOGRAPHY,
            &[
                "地理", "地图", "气候", "地形", "区域", "geography", "climate",
                "terrain", "region",
            ][..],
        ),
        (
            domain_class::ART,
            &[
                "艺术", "绘画", "雕塑", "美术", "设计史", "art", "painting",
                "sculpture", "artist",
            ][..],
        ),
        (
            domain_class::MUSIC,
            &[
                "音乐", "作曲", "乐理", "歌曲", "演奏", "music", "melody",
                "composition", "harmony",
            ][..],
        ),
        (
            domain_class::LANGUAGE,
            &[
                "语言", "语法", "翻译", "词汇", "修辞", "language", "linguistics",
                "grammar", "translation", "vocabulary",
            ][..],
        ),
        (
            domain_class::SPORTS,
            &[
                "体育", "足球", "篮球", "比赛", "运动员", "sports", "football",
                "basketball", "match", "athlete",
            ][..],
        ),
        (
            domain_class::ENTERTAINMENT,
            &[
                "娱乐", "电影", "电视剧", "明星", "综艺", "entertainment",
                "movie", "film", "television", "celebrity",
            ][..],
        ),
        (
            domain_class::RELIGION,
            &[
                "宗教", "佛教", "基督教", "伊斯兰", "神学", "religion",
                "buddh", "christian", "islam", "theology",
            ][..],
        ),
        (
            domain_class::MILITARY,
            &[
                "军事", "军队", "战役", "武器", "将领", "military", "army",
                "campaign", "weapon", "general",
            ][..],
        ),
    ] {
        if keywords.iter().any(|keyword| corpus.contains(keyword)) {
            return class_name.to_string();
        }
    }

    domain_class::CHAT.to_string()
}

async fn generate_domain_class_via_llm(
    transcript: &[String],
    session_title: Option<&str>,
    summary_config: &SummarySection,
    llm_gate: Arc<Semaphore>,
) -> Result<Option<String>> {
    if transcript.is_empty() || summary_config.llm_api_key.trim().is_empty() {
        return Ok(None);
    }

    let _permit = llm_gate.acquire_owned().await?;

    let client = Client::builder()
        .timeout(Duration::from_millis(summary_config.llm_timeout_ms))
        .build()?;
    let url = format!(
        "{}/chat/completions",
        summary_config.llm_base_url.trim_end_matches('/')
    );
    let session_title = session_title.unwrap_or("untitled");
    let transcript_text = transcript.join("\n");
    let allowed_domain_classes = domain_class::ALL.join(", ");
    let request = ChatCompletionsRequest {
        model: &summary_config.llm_model,
        temperature: 0.0,
        messages: vec![
            PromptMessage {
                role: "system",
                content: format!(
                    "你是一个会话主题分类助手。请基于整个会话 transcript（包含用户提问和助手回答）做单标签分类。你必须只返回 JSON 格式数据，不要输出任何解释、markdown、代码块或多余文本。返回格式示例：{{\"domain_class\":\"history\"}}。domain_class 只能从以下候选中选择一个：{allowed_domain_classes}。如果最贴近的是任务执行类，返回 task；如果是纯系统消息，返回 system；如果无法判断，返回 chat。"
                ),
            },
            PromptMessage {
                role: "user",
                content: format!(
                    "session_title: {session_title}\n请基于下面完整 transcript 选择最贴切的单个 domain_class。\ntranscript:\n{transcript_text}"
                ),
            },
        ],
    };

    let response = client
        .post(url)
        .bearer_auth(&summary_config.llm_api_key)
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("domain class llm returned {status}: {body}");
    }

    let payload: ChatCompletionsResponse = response.json().await?;
    let content = payload
        .choices
        .first()
        .map(|choice| choice.message.content.trim().to_string())
        .filter(|text| !text.is_empty());

    let Some(content) = content else {
        return Ok(None);
    };

    let artifact = parse_domain_class_artifact(&content)?;
    let normalized = artifact.domain_class.trim().to_lowercase();
    if !domain_class::is_valid(&normalized) {
        anyhow::bail!("domain class llm returned unsupported domain_class={normalized}");
    }

    Ok(Some(normalized))
}

async fn build_fact_candidates(
    transcript: &[String],
    session_title: Option<&str>,
    inferred_domain_class: &str,
    summary_config: &SummarySection,
    llm_gate: Arc<Semaphore>,
) -> Vec<FactCandidate> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    if summary_config.llm_enabled {
        match generate_ner_artifact_via_llm(
            transcript,
            session_title,
            inferred_domain_class,
            summary_config,
            llm_gate,
        )
        .await
        {
            Ok(Some(artifact)) => {
                for person in artifact.persons.into_iter().take(MAX_PERSONS_PER_RUN) {
                    push_fact_candidate(
                        &mut candidates,
                        &mut seen,
                        FactCandidate::new("person", person, 0.93),
                    );
                }
            }
            Ok(None) => {}
            Err(error) => {
                warn!(error = %error, "summary ner generation failed, falling back to heuristic facts");
            }
        }
    }

    if !candidates.is_empty() {
        candidates.truncate(MAX_FACTS_PER_RUN);
        return candidates;
    }

    for person in extract_person_candidates_from_transcript(transcript)
        .into_iter()
        .take(MAX_PERSONS_PER_RUN)
    {
        push_fact_candidate(
            &mut candidates,
            &mut seen,
            FactCandidate::new("person", person, 0.78),
        );
    }

    if let Some(title) = session_title.filter(|value| !value.trim().is_empty()) {
        push_fact_candidate(
            &mut candidates,
            &mut seen,
            FactCandidate::new(
                "session_focus",
                format!("Session focus is {}.", truncate_text(title, MAX_FACT_CHARS)),
                0.70,
            ),
        );
    }

    for line in transcript {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let normalized = trimmed.to_lowercase();
        if normalized.starts_with("user:")
            && contains_any(
                &normalized,
                &[
                    "prefer",
                    "preference",
                    "like ",
                    "likes ",
                    "偏好",
                    "喜欢",
                    "习惯",
                ],
            )
        {
            let fact_text = sentence_fact("User preference", extract_fact_payload(trimmed));
            push_fact_candidate(
                &mut candidates,
                &mut seen,
                FactCandidate::new("preference", fact_text, 0.91),
            );
        } else if contains_any(
            &normalized,
            &[
                "must",
                "always",
                "never",
                "do not",
                "don't",
                "不能",
                "不要",
                "必须",
            ],
        ) {
            let fact_text = sentence_fact("Persistent constraint", extract_fact_payload(trimmed));
            push_fact_candidate(
                &mut candidates,
                &mut seen,
                FactCandidate::new("constraint", fact_text, 0.95),
            );
        } else if inferred_domain_class == domain_class::TASK
            || contains_any(
                &normalized,
                &[
                    "task",
                    "todo",
                    "follow-up",
                    "next step",
                    "deadline",
                    "待办",
                    "任务",
                    "跟进",
                ],
            )
        {
            let fact_text = sentence_fact("Open task context", extract_fact_payload(trimmed));
            push_fact_candidate(
                &mut candidates,
                &mut seen,
                FactCandidate::new("task_context", fact_text, 0.82),
            );
        }

        if candidates.len() >= MAX_FACTS_PER_RUN {
            break;
        }
    }

    candidates.truncate(MAX_FACTS_PER_RUN);
    candidates
}

fn extract_person_candidates_from_transcript(transcript: &[String]) -> Vec<String> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    for line in transcript {
        let sanitized = line
            .replace(':', " ")
            .replace(',', " ")
            .replace('.', " ")
            .replace('，', " ")
            .replace('。', " ")
            .replace('、', " ")
            .replace('（', " ")
            .replace('）', " ")
            .replace('(', " ")
            .replace(')', " ");

        let tokens = sanitized.split_whitespace().collect::<Vec<_>>();
        let mut current = Vec::new();

        for token in tokens {
            let normalized = token.trim_matches(|ch: char| !ch.is_alphanumeric() && ch != '-');
            if looks_like_person_token(normalized) {
                current.push(normalized);
                continue;
            }

            if current.len() >= 2 {
                let person = current.join(" ");
                if seen.insert(person.clone()) {
                    candidates.push(person);
                }
            }
            current.clear();
        }

        if current.len() >= 2 {
            let person = current.join(" ");
            if seen.insert(person.clone()) {
                candidates.push(person);
            }
        }
    }

    candidates
}

fn looks_like_person_token(token: &str) -> bool {
    if token.len() < 2 {
        return false;
    }

    let mut chars = token.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !first.is_ascii_uppercase() {
        return false;
    }

    if !chars.all(|ch| ch.is_ascii_lowercase() || ch == '-') {
        return false;
    }

    !matches!(
        token,
        "User"
            | "Assistant"
            | "System"
            | "Please"
            | "Then"
            | "First"
            | "Need"
            | "Discussed"
            | "Deployment"
            | "Summary"
            | "Session"
    )
}

async fn generate_ner_artifact_via_llm(
    transcript: &[String],
    session_title: Option<&str>,
    inferred_domain_class: &str,
    summary_config: &SummarySection,
    llm_gate: Arc<Semaphore>,
) -> Result<Option<NerArtifact>> {
    if transcript.is_empty() || summary_config.llm_api_key.trim().is_empty() {
        return Ok(None);
    }

    let _permit = llm_gate.acquire_owned().await?;

    let client = Client::builder()
        .timeout(Duration::from_millis(summary_config.llm_timeout_ms))
        .build()?;
    let url = format!(
        "{}/chat/completions",
        summary_config.llm_base_url.trim_end_matches('/')
    );
    let session_title = session_title.unwrap_or("untitled");
    let transcript_text = transcript.join("\n");
    let request = ChatCompletionsRequest {
        model: &summary_config.llm_model,
        temperature: 0.0,
        messages: vec![
            PromptMessage {
                role: "system",
                content: format!(
                    "你是一个NER识别的 AI 助手。请基于整个会话 transcript（包含用户提问和助手回答）提取去重后的 NER 实体，仅保留人名。你必须只返回 JSON 格式数据，不要输出任何解释、markdown、代码块或多余文本。返回格式示例：{{\"persons\":[\"列宁\",\"马克思\"],\"domain_class\":\"history\"}}。persons 只保留 transcript 中真实出现的人名，不要职位、组织、概念、软件名，也不要重复；domain_class 只能从以下候选中选择一个：{}。",
                    domain_class::ALL.join(", ")
                ),
            },
            PromptMessage {
                role: "user",
                content: format!(
                    "session_title: {session_title}\ndomain_class_hint: {inferred_domain_class}\n请基于下面完整 transcript（包含提问和回答）提取人物名。\ntranscript:\n{transcript_text}"
                ),
            },
        ],
    };

    let response = client
        .post(url)
        .bearer_auth(&summary_config.llm_api_key)
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("summary ner llm returned {status}: {body}");
    }

    let payload: ChatCompletionsResponse = response.json().await?;
    let content = payload
        .choices
        .first()
        .map(|choice| choice.message.content.trim().to_string())
        .filter(|text| !text.is_empty());

    let Some(content) = content else {
        return Ok(None);
    };

    let artifact = parse_ner_artifact(&content)?;
    Ok(Some(NerArtifact {
        persons: artifact
            .persons
            .into_iter()
            .map(|value| truncate_text(&value, 64))
            .filter(|value| !value.trim().is_empty())
            .collect(),
        domain_class: artifact
            .domain_class
            .map(|value| truncate_text(&value, 32)),
    }))
}

fn parse_ner_artifact(content: &str) -> Result<NerArtifact> {
    let sanitized = strip_think_blocks(content);

    if let Ok(artifact) = serde_json::from_str::<NerArtifact>(&sanitized) {
        return Ok(artifact);
    }

    if let Some(candidate) = extract_last_json_object(&sanitized) {
        if let Ok(artifact) = serde_json::from_str::<NerArtifact>(candidate) {
            return Ok(artifact);
        }
    }

    anyhow::bail!(
        "summary ner llm did not return valid json; raw_content={}",
        truncate_text(content, 500)
    )
}

fn parse_domain_class_artifact(content: &str) -> Result<DomainClassArtifact> {
    let sanitized = strip_think_blocks(content);

    if let Ok(artifact) = serde_json::from_str::<DomainClassArtifact>(&sanitized) {
        return Ok(artifact);
    }

    if let Some(candidate) = extract_last_json_object(&sanitized) {
        if let Ok(artifact) = serde_json::from_str::<DomainClassArtifact>(candidate) {
            return Ok(artifact);
        }
    }

    anyhow::bail!(
        "domain class llm did not return valid json; raw_content={}",
        truncate_text(content, 500)
    )
}

fn strip_think_blocks(input: &str) -> String {
    let mut output = input.to_string();

    while let Some(start) = output.find("<think>") {
        let Some(end_relative) = output[start..].find("</think>") else {
            output.replace_range(start.., "");
            break;
        };
        let end = start + end_relative + "</think>".len();
        output.replace_range(start..end, "");
    }

    output.trim().to_string()
}

fn extract_last_json_object(input: &str) -> Option<&str> {
    let bytes = input.as_bytes();
    let mut depth = 0usize;
    let mut start = None;
    let mut last = None;

    for (idx, byte) in bytes.iter().enumerate() {
        match byte {
            b'{' => {
                if depth == 0 {
                    start = Some(idx);
                }
                depth += 1;
            }
            b'}' => {
                if depth == 0 {
                    continue;
                }
                depth -= 1;
                if depth == 0 {
                    if let Some(begin) = start {
                        last = Some(&input[begin..=idx]);
                    }
                    start = None;
                }
            }
            _ => {}
        }
    }

    last
}

fn push_fact_candidate(
    candidates: &mut Vec<FactCandidate>,
    seen: &mut HashSet<String>,
    candidate: Option<FactCandidate>,
) {
    let Some(candidate) = candidate else {
        return;
    };

    let dedupe_key = format!(
        "{}::{}",
        candidate.fact_type.to_lowercase(),
        candidate.fact_text.to_lowercase()
    );
    if seen.insert(dedupe_key) {
        candidates.push(candidate);
    }
}

fn contains_any(input: &str, keywords: &[&str]) -> bool {
    keywords.iter().any(|keyword| input.contains(keyword))
}

fn extract_fact_payload(line: &str) -> &str {
    line.split_once(':')
        .map(|(_, value)| value.trim())
        .unwrap_or_else(|| line.trim())
}

fn sentence_fact(prefix: &str, payload: &str) -> String {
    let payload = payload.trim().trim_end_matches('.');
    if payload.is_empty() {
        prefix.to_string()
    } else {
        format!("{prefix}: {payload}.")
    }
}

fn build_summary_uri(tenant_id: &str, session_id: Uuid, version: i32) -> String {
    format!(
        "memory-summary://tenants/{tenant_id}/sessions/{session_id}/versions/{version}"
    )
}

fn truncate_text(input: &str, limit: usize) -> String {
    let trimmed = input.trim();
    if trimmed.chars().count() <= limit {
        return trimmed.to_string();
    }

    let truncated: String = trimmed.chars().take(limit.saturating_sub(3)).collect();
    format!("{truncated}...")
}

fn normalize_strategy(strategy: String) -> String {
    let trimmed = strategy.trim();
    if trimmed.is_empty() {
        DEFAULT_STRATEGY.to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(not(test))]
fn maybe_inject_test_failure(_strategy: &str, _request_id: &str, _stage: &str) -> Result<()> {
    Ok(())
}

#[cfg(test)]
fn maybe_inject_test_failure(strategy: &str, request_id: &str, stage: &str) -> Result<()> {
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};

    static FAIL_ONCE_TRACKER: OnceLock<Mutex<HashMap<String, usize>>> = OnceLock::new();

    let tracker = FAIL_ONCE_TRACKER.get_or_init(|| Mutex::new(HashMap::new()));
    let key = format!("{request_id}:{stage}");

    if strategy == format!("test-fail-{stage}-always") {
        anyhow::bail!("injected test failure for {stage}");
    }

    if strategy == format!("test-fail-{stage}-once") {
        let mut guard = tracker.lock().expect("test failure tracker lock");
        let counter = guard.entry(key).or_insert(0);
        if *counter == 0 {
            *counter += 1;
            anyhow::bail!("injected single test failure for {stage}");
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn summary_config_for_tests() -> SummarySection {
        SummarySection {
            async_enabled: true,
            llm_enabled: false,
            llm_provider: "minimax".to_string(),
            llm_api_key: String::new(),
            llm_base_url: "https://api.minimax.chat/v1".to_string(),
            llm_model: "MiniMax-M2.5".to_string(),
            llm_timeout_ms: 15_000,
            llm_max_concurrency: 1,
        }
    }

    #[test]
    fn infer_domain_class_prefers_task_keywords() {
        let transcript = vec!["user: please fix the deployment task".to_string()];
        assert_eq!(
            infer_domain_class_heuristic(&transcript, None),
            domain_class::TASK
        );
    }

    #[test]
    fn infer_domain_class_heuristic_detects_history_topics() {
        let transcript = vec![
            "user: 蒋介石和胡宗南之间是什么关系".to_string(),
            "assistant: 这属于民国军事人物关系和历史背景".to_string(),
        ];
        assert_eq!(
            infer_domain_class_heuristic(&transcript, Some("历史人物")),
            domain_class::HISTORY
        );
    }

    #[test]
    fn infer_domain_class_heuristic_detects_physics_topics() {
        let transcript = vec![
            "user: 请解释量子力学和相对论".to_string(),
            "assistant: 我们可以从物理学基本概念开始".to_string(),
        ];
        assert_eq!(
            infer_domain_class_heuristic(&transcript, None),
            domain_class::PHYSICS
        );
    }

    #[test]
    fn infer_domain_class_heuristic_falls_back_to_chat() {
        let transcript = vec![
            "user: hello there".to_string(),
            "assistant: happy to help".to_string(),
        ];
        assert_eq!(
            infer_domain_class_heuristic(&transcript, Some("General chat")),
            domain_class::CHAT
        );
    }

    #[test]
    fn build_summary_uri_formats_stably() {
        let uri = build_summary_uri(
            "tenant-1",
            Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap(),
            3,
        );
        assert_eq!(
            uri,
            "memory-summary://tenants/tenant-1/sessions/550e8400-e29b-41d4-a716-446655440000/versions/3"
        );
    }

    #[tokio::test]
    async fn build_fact_candidates_extracts_preference_and_constraint() {
        let transcript = vec![
            "user: I prefer concise rollout summaries".to_string(),
            "assistant: noted".to_string(),
            "user: Please do not post raw secrets in logs".to_string(),
        ];

        let facts = build_fact_candidates(
            &transcript,
            Some("Rollout session"),
            domain_class::CHAT,
            &summary_config_for_tests(),
            Arc::new(Semaphore::new(1)),
        )
        .await;

        assert!(facts.iter().any(|fact| fact.fact_type == "session_focus"));
        assert!(facts.iter().any(|fact| fact.fact_type == "preference"));
        assert!(facts.iter().any(|fact| fact.fact_type == "constraint"));
    }

    #[tokio::test]
    async fn build_fact_candidates_limits_and_deduplicates() {
        let transcript = vec![
            "user: todo deploy to dev".to_string(),
            "user: todo deploy to dev".to_string(),
            "assistant: follow-up on deployment task".to_string(),
            "user: another task follow-up".to_string(),
        ];

        let facts = build_fact_candidates(
            &transcript,
            None,
            domain_class::TASK,
            &summary_config_for_tests(),
            Arc::new(Semaphore::new(1)),
        )
        .await;

        assert!(facts.len() <= MAX_FACTS_PER_RUN);
        let unique: HashSet<_> = facts
            .iter()
            .map(|fact| format!("{}::{}", fact.fact_type, fact.fact_text))
            .collect();
        assert_eq!(unique.len(), facts.len());
    }

    #[tokio::test]
    async fn build_fact_candidates_extracts_persons_from_full_transcript_without_llm() {
        let transcript = vec![
            "user: We started with Karl Marx and Friedrich Engels".to_string(),
            "assistant: Then we compared them with Vladimir Lenin".to_string(),
        ];

        let facts = build_fact_candidates(
            &transcript,
            Some("People session"),
            domain_class::CHAT,
            &summary_config_for_tests(),
            Arc::new(Semaphore::new(1)),
        )
        .await;

        assert!(facts.iter().any(|fact| fact.fact_type == "person"));
        assert!(facts.iter().any(|fact| fact.fact_text.contains("Karl Marx")));
        assert!(facts.iter().any(|fact| fact.fact_text.contains("Friedrich Engels")));
        assert!(facts.iter().any(|fact| fact.fact_text.contains("Vladimir Lenin")));
    }
}
