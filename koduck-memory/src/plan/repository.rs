use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

use crate::plan::model::{
    CreateEditProposal, CreatePlan, EditProposal, InsertPlanArtifact, InsertPlanEvent,
    Plan, PlanArtifact, PlanEvent, PlanSnapshot, ReviewEditProposal, SavePlanSnapshot,
};
use crate::plan::proposal::{validate_review_transition, EditProposalStatus};
use crate::Result;

#[derive(Clone)]
pub struct PlanRepository {
    pool: PgPool,
}

impl PlanRepository {
    pub fn new(pool: &PgPool) -> Self {
        Self { pool: pool.clone() }
    }

    pub async fn create_plan(&self, params: &CreatePlan) -> Result<Plan> {
        let row = sqlx::query_as::<_, Plan>(
            r#"
            INSERT INTO memory_plans (
                plan_id, tenant_id, session_id, request_id, goal,
                status, created_by, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, now(), now()
            )
            RETURNING plan_id, tenant_id, session_id, request_id, goal,
                      status, created_by, created_at, updated_at
            "#,
        )
        .bind(params.plan_id)
        .bind(&params.tenant_id)
        .bind(params.session_id)
        .bind(&params.request_id)
        .bind(&params.goal)
        .bind(&params.status)
        .bind(&params.created_by)
        .fetch_one(&self.pool)
        .await?;

        info!(
            plan_id = %row.plan_id,
            session_id = %row.session_id,
            status = %row.status,
            "memory plan created"
        );

        Ok(row)
    }

    pub async fn get_plan(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        plan_id: Uuid,
    ) -> Result<Option<Plan>> {
        let row = sqlx::query_as::<_, Plan>(
            r#"
            SELECT plan_id, tenant_id, session_id, request_id, goal,
                   status, created_by, created_at, updated_at
            FROM memory_plans
            WHERE tenant_id = $1 AND session_id = $2 AND plan_id = $3
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .bind(plan_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn update_plan_status(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        plan_id: Uuid,
        status: &str,
    ) -> Result<Option<Plan>> {
        let row = sqlx::query_as::<_, Plan>(
            r#"
            UPDATE memory_plans
            SET status = $4, updated_at = now()
            WHERE tenant_id = $1 AND session_id = $2 AND plan_id = $3
            RETURNING plan_id, tenant_id, session_id, request_id, goal,
                      status, created_by, created_at, updated_at
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .bind(plan_id)
        .bind(status)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn append_event(&self, params: &InsertPlanEvent) -> Result<PlanEvent> {
        let row = sqlx::query_as::<_, PlanEvent>(
            r#"
            INSERT INTO memory_plan_events (
                event_id, tenant_id, session_id, plan_id,
                sequence_num, event_type, payload_json, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, now()
            )
            RETURNING event_id, tenant_id, session_id, plan_id,
                      sequence_num, event_type, payload_json, created_at
            "#,
        )
        .bind(params.event_id)
        .bind(&params.tenant_id)
        .bind(params.session_id)
        .bind(params.plan_id)
        .bind(params.sequence_num)
        .bind(&params.event_type)
        .bind(&params.payload_json)
        .fetch_one(&self.pool)
        .await?;

        info!(
            plan_id = %row.plan_id,
            sequence_num = row.sequence_num,
            event_type = %row.event_type,
            "memory plan event appended"
        );

        Ok(row)
    }

    pub async fn get_max_event_sequence(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        plan_id: Uuid,
    ) -> Result<i64> {
        let max_seq = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COALESCE(MAX(sequence_num), 0)
            FROM memory_plan_events
            WHERE tenant_id = $1 AND session_id = $2 AND plan_id = $3
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .bind(plan_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(max_seq)
    }

    pub async fn list_events(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        plan_id: Uuid,
    ) -> Result<Vec<PlanEvent>> {
        let rows = sqlx::query_as::<_, PlanEvent>(
            r#"
            SELECT event_id, tenant_id, session_id, plan_id,
                   sequence_num, event_type, payload_json, created_at
            FROM memory_plan_events
            WHERE tenant_id = $1 AND session_id = $2 AND plan_id = $3
            ORDER BY sequence_num ASC, created_at ASC
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .bind(plan_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    pub async fn save_snapshot(&self, params: &SavePlanSnapshot) -> Result<PlanSnapshot> {
        let row = sqlx::query_as::<_, PlanSnapshot>(
            r#"
            INSERT INTO memory_plan_snapshots (
                snapshot_id, tenant_id, session_id, plan_id,
                version, state_json, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, now()
            )
            RETURNING snapshot_id, tenant_id, session_id, plan_id,
                      version, state_json, created_at
            "#,
        )
        .bind(params.snapshot_id)
        .bind(&params.tenant_id)
        .bind(params.session_id)
        .bind(params.plan_id)
        .bind(params.version)
        .bind(&params.state_json)
        .fetch_one(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn get_latest_snapshot(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        plan_id: Uuid,
    ) -> Result<Option<PlanSnapshot>> {
        let row = sqlx::query_as::<_, PlanSnapshot>(
            r#"
            SELECT snapshot_id, tenant_id, session_id, plan_id,
                   version, state_json, created_at
            FROM memory_plan_snapshots
            WHERE tenant_id = $1 AND session_id = $2 AND plan_id = $3
            ORDER BY version DESC, created_at DESC
            LIMIT 1
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .bind(plan_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn save_artifact(&self, params: &InsertPlanArtifact) -> Result<PlanArtifact> {
        let row = sqlx::query_as::<_, PlanArtifact>(
            r#"
            INSERT INTO memory_plan_artifacts (
                artifact_id, tenant_id, session_id, plan_id, node_id,
                artifact_type, content_json, object_uri, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, now()
            )
            RETURNING artifact_id, tenant_id, session_id, plan_id, node_id,
                      artifact_type, content_json, object_uri, created_at
            "#,
        )
        .bind(params.artifact_id)
        .bind(&params.tenant_id)
        .bind(params.session_id)
        .bind(params.plan_id)
        .bind(&params.node_id)
        .bind(&params.artifact_type)
        .bind(&params.content_json)
        .bind(&params.object_uri)
        .fetch_one(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn list_artifacts(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        plan_id: Uuid,
        node_id: Option<&str>,
    ) -> Result<Vec<PlanArtifact>> {
        let rows = if let Some(node_id) = node_id {
            sqlx::query_as::<_, PlanArtifact>(
                r#"
                SELECT artifact_id, tenant_id, session_id, plan_id, node_id,
                       artifact_type, content_json, object_uri, created_at
                FROM memory_plan_artifacts
                WHERE tenant_id = $1 AND session_id = $2 AND plan_id = $3 AND node_id = $4
                ORDER BY created_at DESC
                "#,
            )
            .bind(tenant_id)
            .bind(session_id)
            .bind(plan_id)
            .bind(node_id)
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, PlanArtifact>(
                r#"
                SELECT artifact_id, tenant_id, session_id, plan_id, node_id,
                       artifact_type, content_json, object_uri, created_at
                FROM memory_plan_artifacts
                WHERE tenant_id = $1 AND session_id = $2 AND plan_id = $3
                ORDER BY created_at DESC
                "#,
            )
            .bind(tenant_id)
            .bind(session_id)
            .bind(plan_id)
            .fetch_all(&self.pool)
            .await?
        };

        Ok(rows)
    }

    pub async fn create_proposal(&self, params: &CreateEditProposal) -> Result<EditProposal> {
        let row = sqlx::query_as::<_, EditProposal>(
            r#"
            INSERT INTO memory_edit_proposals (
                proposal_id, tenant_id, session_id, plan_id, node_id,
                target_kind, operation, target_ref, before_json, after_json,
                reason, confidence, status, created_by, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, CAST($12 AS NUMERIC(5, 4)), 'proposed', $13, now()
            )
            RETURNING proposal_id, tenant_id, session_id, plan_id, node_id,
                      target_kind, operation, target_ref, before_json, after_json,
                      reason, confidence::DOUBLE PRECISION AS confidence, status,
                      created_by, reviewed_by, created_at, reviewed_at, applied_at
            "#,
        )
        .bind(params.proposal_id)
        .bind(&params.tenant_id)
        .bind(params.session_id)
        .bind(params.plan_id)
        .bind(&params.node_id)
        .bind(&params.target_kind)
        .bind(&params.operation)
        .bind(&params.target_ref)
        .bind(&params.before_json)
        .bind(&params.after_json)
        .bind(&params.reason)
        .bind(params.confidence)
        .bind(&params.created_by)
        .fetch_one(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn get_proposal(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        proposal_id: Uuid,
    ) -> Result<Option<EditProposal>> {
        let row = sqlx::query_as::<_, EditProposal>(
            r#"
            SELECT proposal_id, tenant_id, session_id, plan_id, node_id,
                   target_kind, operation, target_ref, before_json, after_json,
                   reason, confidence::DOUBLE PRECISION AS confidence, status,
                   created_by, reviewed_by, created_at, reviewed_at, applied_at
            FROM memory_edit_proposals
            WHERE tenant_id = $1 AND session_id = $2 AND proposal_id = $3
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .bind(proposal_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn review_proposal(
        &self,
        params: &ReviewEditProposal,
    ) -> Result<Option<EditProposal>> {
        let Some(existing) = self
            .get_proposal(&params.tenant_id, params.session_id, params.proposal_id)
            .await?
        else {
            return Ok(None);
        };
        let current = EditProposalStatus::parse(&existing.status)?;
        let next = EditProposalStatus::review_target(&params.status, params.applied)?;
        let has_after_json = params.after_json.is_some();

        validate_review_transition(current, next, has_after_json)?;

        if current == next && !has_after_json {
            return Ok(Some(existing));
        }

        let row = sqlx::query_as::<_, EditProposal>(
            r#"
            UPDATE memory_edit_proposals
            SET status = $4,
                reviewed_by = $5,
                reviewed_at = COALESCE(reviewed_at, now()),
                after_json = COALESCE($6, after_json),
                applied_at = CASE
                    WHEN $7 AND applied_at IS NULL THEN now()
                    ELSE applied_at
                END
            WHERE tenant_id = $1
              AND session_id = $2
              AND proposal_id = $3
            RETURNING proposal_id, tenant_id, session_id, plan_id, node_id,
                      target_kind, operation, target_ref, before_json, after_json,
                      reason, confidence::DOUBLE PRECISION AS confidence, status,
                      created_by, reviewed_by, created_at, reviewed_at, applied_at
            "#,
        )
        .bind(&params.tenant_id)
        .bind(params.session_id)
        .bind(params.proposal_id)
        .bind(next.as_str())
        .bind(&params.reviewed_by)
        .bind(&params.after_json)
        .bind(next == EditProposalStatus::Applied)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }
}
