use crate::plan::{renderer::render_canvas_state, Plan, PlanNode, PlanNodeKind};

#[test]
fn plan_defaults_to_draft_and_renders_canvas() {
    let mut plan = Plan::new("tenant-1", "session-1", "req-1", "分析市场", Some("user-1".into()));
    let mut node = PlanNode::new("fetch_market_data", PlanNodeKind::ToolExecute, "拉取行情数据");
    node.depends_on.push("llm_plan".to_string());
    plan.nodes.push(node);

    let canvas = render_canvas_state(&plan);

    assert_eq!(plan.status.as_str(), "draft");
    assert_eq!(canvas.plan_id, plan.plan_id);
    assert_eq!(canvas.nodes[0].kind, "tool.execute");
    assert_eq!(canvas.edges[0].source, "llm_plan");
    assert_eq!(canvas.edges[0].target, "fetch_market_data");
}
