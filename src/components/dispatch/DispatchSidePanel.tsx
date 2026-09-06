import { Search, UserCheck, Briefcase } from "lucide-react";
import { useState } from "react";
import type { EngineerMarker, JobMarker } from "./DispatchMap";

interface Props {
  engineers: EngineerMarker[];
  jobs: JobMarker[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const DispatchSidePanel = ({ engineers, jobs, selectedId, onSelect }: Props) => {
  const [tab, setTab] = useState<"engineers" | "jobs">("engineers");
  const [search, setSearch] = useState("");

  const filteredEngineers = engineers.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.specialty.toLowerCase().includes(search.toLowerCase())
  );

  const filteredJobs = jobs.filter((j) =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.serviceType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full lg:w-80 bg-card rounded-xl border border-border shadow-card flex flex-col max-h-[400px] lg:max-h-none">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("engineers")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
            tab === "engineers"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserCheck className="w-4 h-4" /> Engineers ({engineers.length})
        </button>
        <button
          onClick={() => setTab("jobs")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
            tab === "jobs"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Briefcase className="w-4 h-4" /> Jobs ({jobs.length})
        </button>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${tab}...`}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {tab === "engineers" ? (
          filteredEngineers.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No engineers with coordinates</p>
          ) : (
            filteredEngineers.map((eng) => (
              <button
                key={eng.id}
                onClick={() => onSelect(eng.id)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors ${
                  selectedId === eng.id ? "bg-primary/5 border-l-2 border-primary" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${eng.available ? "bg-success" : "bg-muted-foreground"}`} />
                  <span className="text-sm font-medium text-card-foreground">{eng.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{eng.specialty}</p>
                {eng.rating !== null && (
                  <p className="text-xs text-warning mt-0.5">★ {eng.rating}</p>
                )}
              </button>
            ))
          )
        ) : (
          filteredJobs.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No active jobs with coordinates</p>
          ) : (
            filteredJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => onSelect(job.id)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors ${
                  selectedId === job.id ? "bg-primary/5 border-l-2 border-primary" : ""
                }`}
              >
                <p className="text-sm font-medium text-card-foreground">{job.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${
                    job.priority === "urgent" ? "bg-destructive/10 text-destructive" :
                    job.priority === "high" ? "bg-warning/10 text-warning" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {job.priority}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">{job.status.replace(/_/g, " ")}</span>
                </div>
              </button>
            ))
          )
        )}
      </div>
    </div>
  );
};

export default DispatchSidePanel;
