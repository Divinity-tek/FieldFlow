import { Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Region {
  id: string;
  name: string;
  city: string;
}

interface RegionFilterProps {
  regions: Region[];
  value: string;
  onChange: (value: string) => void;
}

const RegionFilter = ({ regions, value, onChange }: RegionFilterProps) => {
  if (regions.length === 0) return null;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] h-9 text-sm">
        <Globe className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
        <SelectValue placeholder="All Regions" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Regions</SelectItem>
        {regions.map(r => (
          <SelectItem key={r.id} value={r.id}>{r.name} — {r.city}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default RegionFilter;
