use anyhow::{Result, bail};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemoryUnitAnchorType {
    Domain,
    Entity,
    Relation,
    DiscourseAction,
    FactType,
}

impl MemoryUnitAnchorType {
    pub fn from_db_value(value: &str) -> Result<Self> {
        match value {
            "domain" => Ok(Self::Domain),
            "entity" => Ok(Self::Entity),
            "relation" => Ok(Self::Relation),
            "discourse_action" => Ok(Self::DiscourseAction),
            "fact_type" => Ok(Self::FactType),
            other => bail!("unsupported memory_unit_anchor.anchor_type: {other}"),
        }
    }

    pub fn as_db_value(&self) -> &'static str {
        match self {
            Self::Domain => "domain",
            Self::Entity => "entity",
            Self::Relation => "relation",
            Self::DiscourseAction => "discourse_action",
            Self::FactType => "fact_type",
        }
    }

    pub fn requires_anchor_value(&self) -> bool {
        matches!(self, Self::Entity | Self::Relation | Self::FactType)
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct MemoryUnitAnchorRow {
    pub id: Uuid,
    pub memory_unit_id: Uuid,
    pub tenant_id: String,
    pub anchor_type: String,
    pub anchor_key: String,
    pub anchor_value: Option<String>,
    pub weight: f64,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryUnitAnchor {
    pub id: Uuid,
    pub memory_unit_id: Uuid,
    pub tenant_id: String,
    pub anchor_type: MemoryUnitAnchorType,
    pub anchor_key: String,
    pub anchor_value: Option<String>,
    pub weight: f64,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl TryFrom<MemoryUnitAnchorRow> for MemoryUnitAnchor {
    type Error = anyhow::Error;

    fn try_from(row: MemoryUnitAnchorRow) -> Result<Self> {
        if row.anchor_key.trim().is_empty() {
            bail!("anchor_key must not be blank");
        }
        if !(0.0..=1.0).contains(&row.weight) {
            bail!("anchor weight must be within 0..=1");
        }

        Ok(Self {
            id: row.id,
            memory_unit_id: row.memory_unit_id,
            tenant_id: row.tenant_id,
            anchor_type: MemoryUnitAnchorType::from_db_value(&row.anchor_type)?,
            anchor_key: row.anchor_key,
            anchor_value: row.anchor_value,
            weight: row.weight,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

#[derive(Debug, Clone)]
pub struct InsertMemoryUnitAnchor {
    pub id: Uuid,
    pub memory_unit_id: Uuid,
    pub tenant_id: String,
    pub anchor_type: MemoryUnitAnchorType,
    pub anchor_key: String,
    pub anchor_value: Option<String>,
    pub weight: f64,
}

impl InsertMemoryUnitAnchor {
    pub fn new(
        tenant_id: impl Into<String>,
        memory_unit_id: Uuid,
        anchor_type: MemoryUnitAnchorType,
        anchor_key: impl Into<String>,
    ) -> Result<Self> {
        let anchor_key = anchor_key.into();
        if anchor_key.trim().is_empty() {
            bail!("anchor_key must not be blank");
        }

        Ok(Self {
            id: Uuid::new_v4(),
            memory_unit_id,
            tenant_id: tenant_id.into(),
            anchor_type,
            anchor_key,
            anchor_value: None,
            weight: 1.0,
        })
    }

    pub fn with_anchor_value(mut self, anchor_value: impl Into<String>) -> Self {
        self.anchor_value = Some(anchor_value.into());
        self
    }

    pub fn should_persist(&self) -> bool {
        if self.anchor_key.trim().eq_ignore_ascii_case("unknown") {
            return false;
        }

        if !self.anchor_type.requires_anchor_value() {
            return true;
        }

        self.anchor_value
            .as_deref()
            .map(str::trim)
            .is_some_and(|value| !value.is_empty())
    }

    pub fn with_weight(mut self, weight: f64) -> Result<Self> {
        if !(0.0..=1.0).contains(&weight) {
            bail!("anchor weight must be within 0..=1");
        }
        self.weight = weight;
        Ok(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anchor_type_round_trip_works() {
        let kind = MemoryUnitAnchorType::from_db_value("discourse_action").unwrap();
        assert_eq!(kind, MemoryUnitAnchorType::DiscourseAction);
        assert_eq!(kind.as_db_value(), "discourse_action");
    }

    #[test]
    fn anchor_builder_rejects_blank_key() {
        let result = InsertMemoryUnitAnchor::new(
            "tenant",
            Uuid::new_v4(),
            MemoryUnitAnchorType::Domain,
            "   ",
        );
        assert!(result.is_err());
    }

    #[test]
    fn anchor_with_unknown_key_is_not_persistable() {
        let params = InsertMemoryUnitAnchor::new(
            "tenant",
            Uuid::new_v4(),
            MemoryUnitAnchorType::Domain,
            "unknown",
        )
        .unwrap();

        assert!(!params.should_persist());
    }

    #[test]
    fn fact_type_anchor_without_value_is_not_persistable() {
        let params = InsertMemoryUnitAnchor::new(
            "tenant",
            Uuid::new_v4(),
            MemoryUnitAnchorType::FactType,
            "preference",
        )
        .unwrap();

        assert!(!params.should_persist());
    }

    #[test]
    fn domain_anchor_without_value_remains_persistable() {
        let params = InsertMemoryUnitAnchor::new(
            "tenant",
            Uuid::new_v4(),
            MemoryUnitAnchorType::Domain,
            "task",
        )
        .unwrap();

        assert!(params.should_persist());
    }
}
