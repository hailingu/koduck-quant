use serde::{Deserialize, Serialize};

use crate::plan::{Plan, PlanNodeStatus};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CanvasNode {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CanvasEdge {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CanvasState {
    pub plan_id: String,
    pub status: String,
    pub nodes: Vec<CanvasNode>,
    pub edges: Vec<CanvasEdge>,
}

pub fn render_canvas_state(plan: &Plan) -> CanvasState {
    let nodes = plan
        .nodes
        .iter()
        .map(|node| CanvasNode {
            id: node.node_id.clone(),
            title: node.title.clone(),
            kind: node.kind.as_str().to_string(),
            status: node.status.as_str().to_string(),
        })
        .collect::<Vec<_>>();

    let edges = plan
        .nodes
        .iter()
        .flat_map(|node| {
            node.depends_on.iter().map(move |source| CanvasEdge {
                source: source.clone(),
                target: node.node_id.clone(),
            })
        })
        .collect();

    CanvasState {
        plan_id: plan.plan_id.clone(),
        status: plan.status.as_str().to_string(),
        nodes,
        edges,
    }
}

pub fn blocks_execution(status: &PlanNodeStatus) -> bool {
    matches!(
        status,
        PlanNodeStatus::Pending | PlanNodeStatus::Running | PlanNodeStatus::WaitingApproval
    )
}
