export type InterviewLevel = "screening" | "competency" | "deep_dive";

export type Readiness =
  | "not_ready"
  | "needs_preparation"
  | "interview_ready"
  | "strong_candidate";

export interface RoleAnalysis {
  title: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  technicalCompetencies: string[];
  behaviouralCompetencies: string[];
  experienceExpectations: string;
  keywords: string[];
  concepts: string[];
  qualifications: string[];
}

export interface CandidateAnalysis {
  keySkills: string[];
  relevantExperience: string[];
  relevantProjects: string[];
  achievements: string[];
  strengths: string[];
  missingSkills: string[];
  weakAreas: string[];
  claimsToProbe: string[];
  prepAreas: string[];
}

export interface JobFit {
  score: number;
  label: string;
  strongMatch: string[];
  partialMatch: string[];
  missingWeak: string[];
  summary: string;
}

export interface AnalyzeResult {
  role: RoleAnalysis;
  candidate: CandidateAnalysis;
  jobFit: JobFit;
}

export interface InterviewTurn {
  id: string;
  level: InterviewLevel;
  question: string;
  answer: string;
  assessment?: string;
  whatWasGood?: string[];
  whatCouldBeBetter?: string[];
  idealDirection?: string;
  score?: number;
}

export interface NextQuestionResponse {
  level: InterviewLevel;
  question: string;
  done: boolean;
  reason?: string;
  difficulty: "easier" | "same" | "harder";
}

export interface CompetencyScores {
  roleFit: number;
  technicalKnowledge: number;
  problemSolving: number;
  communication: number;
  confidence: number;
  depthOfUnderstanding: number;
  behaviouralFit: number;
}

export interface PrepGap {
  priority: number;
  topic: string;
  review: string[];
}

export interface InterviewReport {
  overallScore: number;
  competencies: CompetencyScores;
  questionFeedback: InterviewTurn[];
  strengths: string[];
  weaknesses: string[];
  preparationGaps: PrepGap[];
  readiness: Readiness;
  readinessRationale: string;
  prepPlanSummary: string;
}
