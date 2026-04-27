use crate::plan::{Plan, PlanEvent, PlanEventKind, PlanNode, PlanNodeKind};

#[derive(Debug, Clone)]
pub struct PlanOrchestrator {
    tenant_id: String,
    session_id: String,
    request_id: String,
}

impl PlanOrchestrator {
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: impl Into<String>,
        request_id: impl Into<String>,
    ) -> Self {
        Self {
            tenant_id: tenant_id.into(),
            session_id: session_id.into(),
            request_id: request_id.into(),
        }
    }

    pub fn create_minimal_plan(&self, goal: impl Into<String>, created_by: Option<String>) -> Plan {
        let goal = goal.into();
        let mut plan = Plan::new(
            self.tenant_id.clone(),
            self.session_id.clone(),
            self.request_id.clone(),
            goal,
            created_by,
        );
        plan.nodes.push(PlanNode::new(
            "llm_plan",
            PlanNodeKind::LlmPlan,
            "生成执行计划",
        ));
        plan
    }

    pub fn created_event(&self, plan: &Plan) -> PlanEvent {
        PlanEvent::plan_created(
            self.tenant_id.clone(),
            self.session_id.clone(),
            self.request_id.clone(),
            plan.plan_id.clone(),
            plan.goal.clone(),
        )
    }

    pub fn node_started_event(&self, plan: &Plan, node: &PlanNode) -> PlanEvent {
        PlanEvent::node_status(
            self.tenant_id.clone(),
            self.session_id.clone(),
            self.request_id.clone(),
            plan.plan_id.clone(),
            node.node_id.clone(),
            PlanEventKind::PlanNodeStarted,
            "running",
            node.title.clone(),
        )
    }

    pub fn node_completed_event(&self, plan: &Plan, node: &PlanNode) -> PlanEvent {
        PlanEvent::node_status(
            self.tenant_id.clone(),
            self.session_id.clone(),
            self.request_id.clone(),
            plan.plan_id.clone(),
            node.node_id.clone(),
            PlanEventKind::PlanNodeCompleted,
            "completed",
            node.title.clone(),
        )
    }

    pub fn completed_event(&self, plan: &Plan) -> PlanEvent {
        PlanEvent::plan_completed(
            self.tenant_id.clone(),
            self.session_id.clone(),
            self.request_id.clone(),
            plan.plan_id.clone(),
        )
    }
}
