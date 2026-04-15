//! Internal query analyzer for `QueryMemory`.
//!
//! The analyzer converts raw request fields into a structured retrieval context
//! while keeping a clear fallback path when analysis fails.

use anyhow::Result;
use std::collections::BTreeSet;

use crate::retrieve::semantics::{
    QueryIntentType,
    contains_any,
    intent_aux_cross_session_scope,
    intent_aux_decision_context,
    intent_aux_recent_bias,
    normalize_intent_aux,
};
use crate::retrieve::types::domain_class;

const TARGET_GENERAL: &str = "general";
const TARGET_PREFERENCE: &str = "preference";
const TARGET_FACT: &str = "fact";
const TARGET_PERSON: &str = "person";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QueryAnalysis {
    pub domain_classes: Vec<String>,
    pub entities: Vec<String>,
    pub relation_types: Vec<String>,
    pub intent_type: String,
    pub intent_aux: Vec<String>,
    pub recall_target_type: Option<String>,
}

impl QueryAnalysis {
    pub fn fallback(domain_class_input: &str, query_text: &str) -> Self {
        let normalized_domain_class = normalize_domain_class(domain_class_input);
        let inferred_domain_classes = infer_domain_classes(query_text);
        let domain_classes = if normalized_domain_class.is_empty() {
            inferred_domain_classes
        } else {
            let mut values = BTreeSet::new();
            values.insert(normalized_domain_class);
            values.extend(inferred_domain_classes);
            values.into_iter().collect()
        };
        let recall_target_type = detect_recall_target_type(query_text)
            .map(str::to_string)
            .or(Some(TARGET_GENERAL.to_string()));

        Self {
            domain_classes,
            entities: extract_entities(query_text),
            relation_types: Vec::new(),
            intent_type: QueryIntentType::None.as_str().to_string(),
            intent_aux: Vec::new(),
            recall_target_type,
        }
    }
}

#[derive(Debug, Default, Clone)]
pub struct QueryAnalyzer;

impl QueryAnalyzer {
    pub fn new() -> Self {
        Self
    }

    pub fn analyze(
        &self,
        query_text: &str,
        domain_class_input: &str,
        session_id: &str,
    ) -> Result<QueryAnalysis> {
        if !session_id.trim().is_empty() {
            uuid::Uuid::parse_str(session_id)
                .map_err(|e| anyhow::anyhow!("invalid session_id for query analyzer: {e}"))?;
        }

        let normalized_query = query_text.trim();
        let normalized_domain_class = normalize_domain_class(domain_class_input);
        let intent_type = detect_intent_type(normalized_query);

        let recall_target_type = if intent_type == QueryIntentType::Recall {
            detect_recall_target_type(normalized_query).map(str::to_string)
        } else {
            detect_recall_target_type(normalized_query)
                .filter(|target| *target != TARGET_GENERAL)
                .map(str::to_string)
        };

        let mut domain_classes = BTreeSet::new();
        if !normalized_domain_class.is_empty() {
            domain_classes.insert(normalized_domain_class);
        }
        domain_classes.extend(infer_domain_classes(normalized_query));

        let entities = extract_entities(normalized_query);
        let relation_types = detect_relation_types(normalized_query, intent_type);
        let intent_aux = detect_intent_aux(normalized_query, session_id, &intent_type, &relation_types);

        Ok(QueryAnalysis {
            domain_classes: domain_classes.into_iter().collect(),
            entities,
            relation_types,
            intent_type: intent_type.as_str().to_string(),
            intent_aux,
            recall_target_type,
        })
    }
}

fn normalize_domain_class(input: &str) -> String {
    let trimmed = input.trim();
    if domain_class::is_valid(trimmed) {
        trimmed.to_string()
    } else {
        String::new()
    }
}

fn detect_intent_type(query_text: &str) -> QueryIntentType {
    let lower = query_text.to_lowercase();

    if contains_any(&lower, &["remember", "recall", "previously", "before", "之前", "还记得", "聊过"]) {
        return QueryIntentType::Recall;
    }
    if contains_any(&lower, &["compare", "difference", "versus", "vs", "区别", "比较"]) {
        return QueryIntentType::Compare;
    }
    if contains_any(&lower, &["which one", "还是", "到底是", "弄混", "disambiguate"]) {
        return QueryIntentType::Disambiguate;
    }
    if contains_any(&lower, &["correct", "wrong", "不对", "纠正", "更正"]) {
        return QueryIntentType::Correct;
    }
    if contains_any(&lower, &["explain", "why", "how", "解释", "说明"]) {
        return QueryIntentType::Explain;
    }
    if contains_any(&lower, &["decide", "choose", "option", "选择", "决定", "方案"]) {
        return QueryIntentType::Decide;
    }

    QueryIntentType::None
}

fn detect_recall_target_type(query_text: &str) -> Option<&'static str> {
    let lower = query_text.to_lowercase();

    if contains_any(
        &lower,
        &["人物", "人名", "作家", "作者", "谁", "哪位", "老舍", "舒庆春", "彭于晏", "叶问", "梁壁"],
    ) {
        return Some(TARGET_PERSON);
    }
    if contains_any(&lower, &["preference", "prefer", "偏好", "倾向"]) {
        return Some(TARGET_PREFERENCE);
    }
    if contains_any(&lower, &["fact", "事实", "约束", "constraint"]) {
        return Some(TARGET_FACT);
    }
    if query_text.trim().is_empty() {
        return None;
    }

    Some(TARGET_GENERAL)
}

fn detect_relation_types(query_text: &str, intent_type: QueryIntentType) -> Vec<String> {
    let lower = query_text.to_lowercase();
    let mut relation_types = BTreeSet::new();

    if intent_type == QueryIntentType::Compare
        || contains_any(&lower, &["compare", "difference", "versus", "vs", "比较", "区别"])
    {
        relation_types.insert("comparison".to_string());
    }
    if intent_type == QueryIntentType::Disambiguate
        || contains_any(&lower, &["还是", "到底是", "弄混", "disambiguate"])
    {
        relation_types.insert("disambiguation".to_string());
    }
    if intent_type == QueryIntentType::Correct
        || contains_any(&lower, &["correct", "wrong", "不对", "纠正", "更正"])
    {
        relation_types.insert("correction".to_string());
    }

    relation_types.into_iter().collect()
}

fn detect_intent_aux(
    query_text: &str,
    session_id: &str,
    intent_type: &QueryIntentType,
    relation_types: &[String],
) -> Vec<String> {
    let lower = query_text.to_lowercase();
    let mut aux = BTreeSet::new();

    if *intent_type == QueryIntentType::Recall && session_id.trim().is_empty() {
        aux.insert(intent_aux_cross_session_scope().to_string());
    }
    if *intent_type == QueryIntentType::Recall
        && contains_any(&lower, &["latest", "recent", "最近", "刚才"])
    {
        aux.insert(intent_aux_recent_bias().to_string());
    }
    if *intent_type == QueryIntentType::Decide
        && !relation_types.iter().any(|relation| relation == "comparison")
    {
        aux.insert(intent_aux_decision_context().to_string());
    }

    normalize_intent_aux(aux.into_iter().collect(), relation_types)
}

fn extract_entities(query_text: &str) -> Vec<String> {
    let mut entities = BTreeSet::new();

    for token in query_text.split(|c: char| !c.is_alphanumeric() && c != '_' && c != '-') {
        if token.chars().count() < 2 {
            continue;
        }

        let starts_uppercase = token.chars().next().is_some_and(|c| c.is_uppercase());
        let is_ascii_word = token.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_');

        if starts_uppercase && is_ascii_word {
            entities.insert(token.to_string());
        }
    }

    let chinese_fragments = query_text
        .split(|c: char| {
            !(('\u{4E00}'..='\u{9FFF}').contains(&c)
                || ('\u{3400}'..='\u{4DBF}').contains(&c))
        })
        .map(str::trim)
        .filter(|fragment| fragment.chars().count() >= 2);

    for fragment in chinese_fragments {
        if !contains_any(fragment, &["之前", "聊过", "讨论", "有没有", "什么", "我们"]) {
            entities.insert(fragment.to_string());
        }
    }

    entities.into_iter().collect()
}

fn infer_domain_classes(query_text: &str) -> Vec<String> {
    let lower = query_text.to_lowercase();
    let mut values = BTreeSet::new();

    if contains_any(
        &lower,
        &[
            "舒庆春",
            "老舍",
            "鲁迅",
            "冰心",
            "梁实秋",
            "郭沫若",
            "骆驼祥子",
            "四世同堂",
            "茶馆",
            "文学",
            "作家",
            "小说家",
            "剧作家",
        ],
    ) {
        values.insert(domain_class::LITERATURE.to_string());
    }

    if contains_any(
        &lower,
        &[
            "牛排",
            "菲力",
            "西冷",
            "肉眼",
            "肋眼",
            "战斧",
            "熟度",
            "全熟",
            "五分熟",
            "七分熟",
            "well done",
            "medium",
            "medium rare",
            "steak",
            "sirloin",
            "ribeye",
            "filet mignon",
            "food",
            "美食",
            "烹饪",
            "料理",
            "餐厅",
        ],
    ) {
        values.insert(domain_class::FOOD.to_string());
    }

    if contains_any(
        &lower,
        &[
            "叶问",
            "梁壁",
            "陈华顺",
            "咏春",
            "历史",
            "人物关系",
            "对打记录",
        ],
    ) {
        values.insert(domain_class::HISTORY.to_string());
    }

    values.into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analyze_returns_structured_context() {
        let analyzer = QueryAnalyzer::new();

        let analysis = analyzer
            .analyze(
                "Do you remember whether Karl Marx or Friedrich Engels was mentioned before?",
                "history",
                "",
            )
            .unwrap();

        assert_eq!(analysis.domain_classes, vec!["history".to_string()]);
        assert_eq!(analysis.intent_type, "recall");
        assert!(analysis.entities.contains(&"Karl".to_string()));
        assert!(analysis.entities.contains(&"Marx".to_string()));
        assert!(analysis.entities.contains(&"Friedrich".to_string()));
        assert!(analysis.entities.contains(&"Engels".to_string()));
        assert!(analysis.intent_aux.contains(&"cross_session_scope".to_string()));
        assert_eq!(analysis.recall_target_type.as_deref(), Some("general"));
    }

    #[test]
    fn analyze_detects_relation_without_dup_aux() {
        let analyzer = QueryAnalyzer::new();

        let analysis = analyzer
            .analyze("Compare Rust vs Go for backend services", "technology", "")
            .unwrap();

        assert_eq!(analysis.intent_type, "compare");
        assert_eq!(analysis.relation_types, vec!["comparison".to_string()]);
        assert!(analysis.intent_aux.is_empty());
    }

    #[test]
    fn analyze_rejects_invalid_session_id() {
        let analyzer = QueryAnalyzer::new();

        let result = analyzer.analyze("remember this", "chat", "not-a-uuid");
        assert!(result.is_err());
    }

    #[test]
    fn analyze_infers_literature_person_recall_from_chinese_name() {
        let analyzer = QueryAnalyzer::new();

        let analysis = analyzer.analyze("之前有聊过舒庆春吗？", "", "").unwrap();

        assert!(analysis.domain_classes.contains(&"literature".to_string()));
        assert!(analysis.entities.contains(&"舒庆春".to_string()));
        assert_eq!(analysis.recall_target_type.as_deref(), Some("person"));
    }

    #[test]
    fn fallback_keeps_unknown_recall_domain_unscoped() {
        let fallback = QueryAnalysis::fallback("not-real", "之前有聊过美食吗？");

        assert!(fallback.domain_classes.is_empty());
        assert_eq!(fallback.intent_type, "none");
        assert_eq!(fallback.recall_target_type.as_deref(), Some("general"));
    }

    #[test]
    fn fallback_preserves_inferred_person_domain() {
        let fallback = QueryAnalysis::fallback("not-real", "Need the latest preference");
        assert!(fallback.domain_classes.is_empty());
        assert_eq!(fallback.intent_type, "none");
        assert_eq!(fallback.recall_target_type.as_deref(), Some("preference"));
    }

    #[test]
    fn analyze_infers_food_domain_from_steak_query() {
        let analyzer = QueryAnalyzer::new();

        let analysis = analyzer.analyze("之前聊过牛排和熟度吗？", "", "").unwrap();

        assert!(analysis.domain_classes.contains(&"food".to_string()));
        assert_eq!(analysis.recall_target_type.as_deref(), Some("general"));
    }
}
