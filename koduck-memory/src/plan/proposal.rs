use anyhow::{anyhow, bail};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EditProposalStatus {
    Proposed,
    Approved,
    Rejected,
    Edited,
    Applied,
}

impl EditProposalStatus {
    pub fn parse(value: &str) -> anyhow::Result<Self> {
        match value {
            "proposed" => Ok(Self::Proposed),
            "approved" => Ok(Self::Approved),
            "rejected" => Ok(Self::Rejected),
            "edited" => Ok(Self::Edited),
            "applied" => Ok(Self::Applied),
            other => Err(anyhow!("unsupported edit proposal status: {other}")),
        }
    }

    pub fn review_target(status: &str, applied: bool) -> anyhow::Result<Self> {
        if applied {
            return Ok(Self::Applied);
        }
        Self::parse(status)
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Proposed => "proposed",
            Self::Approved => "approved",
            Self::Rejected => "rejected",
            Self::Edited => "edited",
            Self::Applied => "applied",
        }
    }

    pub fn can_transition_to(self, next: Self) -> bool {
        if self == next {
            return true;
        }

        match self {
            Self::Proposed => matches!(
                next,
                Self::Approved | Self::Rejected | Self::Edited | Self::Applied
            ),
            Self::Edited => matches!(next, Self::Approved | Self::Rejected | Self::Edited | Self::Applied),
            Self::Approved => matches!(next, Self::Applied),
            Self::Rejected | Self::Applied => false,
        }
    }
}

pub fn validate_review_transition(
    current: EditProposalStatus,
    next: EditProposalStatus,
    has_after_json: bool,
) -> anyhow::Result<()> {
    if !current.can_transition_to(next) {
        bail!(
            "invalid edit proposal status transition: {} -> {}",
            current.as_str(),
            next.as_str()
        );
    }

    if next == EditProposalStatus::Edited && !has_after_json {
        bail!("edited edit proposal review requires after_json");
    }

    Ok(())
}
