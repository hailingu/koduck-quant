use sqlx::PgPool;
use uuid::Uuid;

use crate::plan::model::{
    CreateEditProposal, CreatePlan, EditProposal, InsertPlanArtifact, InsertPlanEvent,
    Plan, PlanArtifact, PlanEvent, PlanSnapshot, ReviewEditProposal, SavePlanSnapshot,
};
use crate::plan::PlanRepository;
use crate::Result;

#[derive(Clone)]
pub struct PlanService {
    repository: PlanRepository,
}

impl PlanService {
    pub fn new(pool: &PgPool) -> Self {
        Self {
            repository: PlanRepository::new(pool),
        }
    }

    pub fn from_repository(repository: PlanRepository) -> Self {
        Self { repository }
    }

    pub async fn create_plan(&self, params: &CreatePlan) -> Result<Plan> {
        self.repository.create_plan(params).await
    }

    pub async fn append_event(&self, params: &InsertPlanEvent) -> Result<PlanEvent> {
        self.repository.append_event(params).await
    }

    pub async fn replay_events(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        plan_id: Uuid,
    ) -> Result<Vec<PlanEvent>> {
        self.repository.list_events(tenant_id, session_id, plan_id).await
    }

    pub async fn save_snapshot(&self, params: &SavePlanSnapshot) -> Result<PlanSnapshot> {
        self.repository.save_snapshot(params).await
    }

    pub async fn get_latest_snapshot(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        plan_id: Uuid,
    ) -> Result<Option<PlanSnapshot>> {
        self.repository
            .get_latest_snapshot(tenant_id, session_id, plan_id)
            .await
    }

    pub async fn save_artifact(&self, params: &InsertPlanArtifact) -> Result<PlanArtifact> {
        self.repository.save_artifact(params).await
    }

    pub async fn create_proposal(
        &self,
        params: &CreateEditProposal,
    ) -> Result<EditProposal> {
        self.repository.create_proposal(params).await
    }

    pub async fn review_proposal(
        &self,
        params: &ReviewEditProposal,
    ) -> Result<Option<EditProposal>> {
        self.repository.review_proposal(params).await
    }
}
