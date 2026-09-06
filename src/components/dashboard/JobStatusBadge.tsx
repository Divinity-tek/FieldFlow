import type { JobStatus } from "@/types";

const statusConfig: Record<JobStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning/10 text-warning" },
  assigned: { label: "Assigned", className: "bg-info/10 text-info" },
  accepted: { label: "Accepted", className: "bg-primary/10 text-primary" },
  on_the_way: { label: "On the Way", className: "bg-accent/10 text-accent" },
  in_progress: { label: "In Progress", className: "bg-accent/10 text-accent" },
  completed: { label: "Completed", className: "bg-success/10 text-success" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
};

const JobStatusBadge = ({ status }: { status: JobStatus }) => {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
};

export default JobStatusBadge;
