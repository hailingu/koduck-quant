use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlanNodeKind {
    LlmPlan,
    LlmReason,
    ToolExecute,
    MemoryQuery,
    MemoryProposeUpdate,
    MemoryApplyUpdate,
    KnowledgeQuery,
    KnowledgeProposeEdit,
    KnowledgeApplyEdit,
    HumanApproval,
    HumanEdit,
    ArtifactRender,
}

impl PlanNodeKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::LlmPlan => "llm.plan",
            Self::LlmReason => "llm.reason",
            Self::ToolExecute => "tool.execute",
            Self::MemoryQuery => "memory.query",
            Self::MemoryProposeUpdate => "memory.propose_update",
            Self::MemoryApplyUpdate => "memory.apply_update",
            Self::KnowledgeQuery => "knowledge.query",
            Self::KnowledgeProposeEdit => "knowledge.propose_edit",
            Self::KnowledgeApplyEdit => "knowledge.apply_edit",
            Self::HumanApproval => "human.approval",
            Self::HumanEdit => "human.edit",
            Self::ArtifactRender => "artifact.render",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlanNodeStatus {
    Pending,
    Running,
    WaitingApproval,
    Completed,
    Failed,
    Skipped,
    Cancelled,
}

impl PlanNodeStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Running => "running",
            Self::WaitingApproval => "waiting_approval",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Skipped => "skipped",
            Self::Cancelled => "cancelled",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlanNode {
    pub node_id: String,
    pub kind: PlanNodeKind,
    pub status: PlanNodeStatus,
    pub title: String,
    #[serde(default)]
    pub depends_on: Vec<String>,
    #[serde(default)]
    pub arguments: Value,
    #[serde(default)]
    pub result_artifact_id: Option<String>,
}

impl PlanNode {
    pub fn new(
        node_id: impl Into<String>,
        kind: PlanNodeKind,
        title: impl Into<String>,
    ) -> Self {
        Self {
            node_id: node_id.into(),
            kind,
            status: PlanNodeStatus::Pending,
            title: title.into(),
            depends_on: Vec::new(),
            arguments: Value::Object(serde_json::Map::new()),
            result_artifact_id: None,
        }
    }
}
