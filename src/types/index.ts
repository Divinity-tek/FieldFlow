export type UserRole = 'admin' | 'team_lead' | 'partner' | 'client' | 'engineer';

export type JobStatus = 'pending' | 'assigned' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'pending';
}

export interface Job {
  id: string;
  title: string;
  description: string;
  status: JobStatus;
  clientName: string;
  engineerName?: string;
  location: string;
  scheduledAt: string;
  createdAt: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  serviceType: string;
  price?: number;
}

export interface StatsCard {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
}
