export type Severity='low'|'medium'|'high'|'critical';
export type InsightKind='recovery'|'growth'|'operations'|'risk';
export type AgentInsight={id:string;kind:InsightKind;severity:Severity;title:string;summary:string;confidence:number;estimatedImpactCents?:number;evidence:string[];recommendedAction:string;requiresApproval:boolean;createdAt:string};
export type BusinessSnapshot={workspaceId:string;revenueCents:number;previousRevenueCents:number;refundPendingCents:number;duplicateChargeCandidates:{id:string;amountCents:number;description:string}[];inventoryDays?:number;conversionRate?:number;previousConversionRate?:number};
