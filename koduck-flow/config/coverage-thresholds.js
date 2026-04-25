/**
 * Coverage Threshold Configuration
 * Defines phased coverage targets for Duck Flow project
 *
 * Strategy: Incremental improvement with module-specific goals
 * Timeline: 9-week progressive enhancement
 * Metrics: Statements, Branches, Functions, Lines
 */

export default {
  // Global coverage thresholds - phased approach
  global: {
    // Week 0-2: Establish baseline and CI infrastructure
    phase_0: {
      period: "Week 0-2 (Sprint 0)",
      deadline: "2025-11-18",
      targets: {
        statements: 35, // Current: 34.71%, Target: 35% (baseline)
        branches: 80, // Current: 81.49%, Maintain above target ✅
        functions: 83, // Current: 83.94%, Maintain above target ✅
        lines: 35, // Current: 34.71%, Target: 35% (baseline)
      },
      description: "Establish baseline, setup CI/CD infrastructure",
    },

    // Week 3-4: Initial improvements with unit tests
    phase_1: {
      period: "Week 3-4 (Sprint 1)",
      deadline: "2025-12-02",
      targets: {
        statements: 45,
        branches: 82,
        functions: 84,
        lines: 45,
      },
      description: "Begin adding unit tests, start Phase 1 improvements",
    },

    // Week 5-6: Accelerate test addition
    phase_2: {
      period: "Week 5-6 (Sprint 2)",
      deadline: "2025-12-16",
      targets: {
        statements: 60,
        branches: 83,
        functions: 85,
        lines: 60,
      },
      description: "Increase test coverage significantly",
    },

    // Week 7-8: Approach target
    phase_3: {
      period: "Week 7-8 (Sprint 3)",
      deadline: "2025-12-30",
      targets: {
        statements: 75,
        branches: 84,
        functions: 86,
        lines: 75,
      },
      description: "Intensive test addition phase",
    },

    // Week 9: Final sprint to target
    phase_4: {
      period: "Week 9+ (Sprint 4+)",
      deadline: "2026-01-13",
      targets: {
        statements: 85, // Primary goal
        branches: 85,
        functions: 85,
        lines: 85, // Primary goal
      },
      description: "Final improvements to reach target",
    },
  },

  // Module-specific thresholds
  modules: {
    // Core DI (Dependency Injection) system - highest priority
    "src/di": {
      priority: "CRITICAL",
      rationale: "Core infrastructure, must be fully tested",
      targets: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
      currentStatus: "Review needed",
      notes: "Foundation of entire system",
    },

    // Runtime and execution engine
    "src/runtime": {
      priority: "CRITICAL",
      rationale: "Mission-critical component",
      targets: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
      currentStatus: "Review needed",
      notes: "Performance and correctness critical",
    },

    // Entity and worker system
    "src/entity": {
      priority: "HIGH",
      rationale: "Core data structures",
      targets: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
      currentStatus: "Review needed",
      notes: "Used throughout system",
    },

    // Worker pool management
    "src/worker-pool": {
      priority: "HIGH",
      rationale: "Resource management critical",
      targets: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
      currentStatus: "Review needed",
      notes: "Performance and reliability",
    },

    // Render and display
    "src/render": {
      priority: "MEDIUM",
      rationale: "User-facing features",
      targets: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
      currentStatus: "Review needed",
      notes: "UX quality matters",
    },

    // Configuration and utilities
    "src/config": {
      priority: "MEDIUM",
      rationale: "System configuration",
      targets: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
      currentStatus: "Review needed",
      notes: "Must be well-tested",
    },

    // Utilities and helpers
    "src/utils": {
      priority: "MEDIUM",
      rationale: "Reusable functions",
      targets: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
      currentStatus: "Review needed",
      notes: "Support many features",
    },

    // Testing utilities
    "src/test": {
      priority: "LOW",
      rationale: "Test helpers",
      targets: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
      currentStatus: "Review needed",
      notes: "Lower priority than production code",
    },
  },

  // Enforcement rules
  enforcement: {
    // PR checks - fail if thresholds not met
    pullRequest: {
      enabled: true,
      failOnDecline: true,
      comment: true,
      requiredStatus: "success",
      allowWaivers: false,
      description: "Mandatory coverage checks on all PRs",
    },

    // Commit checks - warn but allow
    commit: {
      enabled: true,
      failOnDecline: false,
      warn: true,
      description: "Advisory checks on commits",
    },

    // Branch protection
    branchProtection: {
      enabled: true,
      requiredChecks: ["codecov/patch", "codecov/project"],
      dismissStaleReviews: false,
      description: "Branch protection rules for main/develop",
    },

    // Email notifications
    notifications: {
      enabled: true,
      onDecline: true,
      recipients: ["team@example.com"],
      frequency: "daily",
    },
  },

  // Waivers and exceptions
  exceptions: {
    // Files exempt from coverage checks
    excludedPatterns: [
      "src/**/*.test.ts", // Test files themselves
      "src/**/*.spec.ts",
      "src/**/__tests__/**",
      "dist/**", // Build output
      "coverage/**", // Coverage reports
      ".storybook/**", // Storybook config
    ],

    // Waiver policy
    waivable: true,
    waiverApprovalRequired: true,
    maxWaiverDuration: 7, // days
    waiverReason: "Document required for all waivers",
  },

  // Reporting and tracking
  reporting: {
    // Generate trend reports
    trends: {
      enabled: true,
      frequency: "daily",
      retentionDays: 90,
    },

    // Regression detection
    regressionDetection: {
      enabled: true,
      threshold: 5, // alert if drops >5%
      trackingMetric: "statements",
    },

    // Dashboard updates
    dashboardUpdates: {
      enabled: true,
      frequency: "real-time",
      includeMetrics: ["statements", "branches", "functions", "lines"],
    },

    // Archive old data
    archival: {
      enabled: true,
      retentionDays: 90,
      archiveLocation: "gs://coverage-archive/",
    },
  },

  // Migration strategy
  migration: {
    startDate: "2025-11-04",
    endDate: "2026-01-13",
    totalWeeks: 10,
    phasedApproach: true,
    communicationStrategy: "Weekly emails and standups",
    trainingRequired: true,
    documentationUrl: "docs/coverage-threshold-guide.md",
  },
};
