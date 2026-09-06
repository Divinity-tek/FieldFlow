import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Plus,
  Search,
  MapPin,
  Building2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type Props = {
  projectId: string;
};

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-muted text-muted-foreground",
  assigned: "bg-primary/15 text-primary",
  installation: "bg-warning/15 text-warning",
  testing: "bg-accent/15 text-accent",
  completed: "bg-success/15 text-success",
};

const ProjectSites = ({ projectId }: Props) => {
  const [search, setSearch] = useState("");

  // Dialog state (used in Part 2)
  const [open, setOpen] = useState(false);

  // Edit state (used in Part 2)
  const [editingSite, setEditingSite] = useState<any>(null);

  const [form, setForm] = useState({
      site_code: "",
      site_name: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postal_code: "",

      contact_name: "",
      contact_phone: "",
      contact_email: "",

      device_count: 0,

      status: "planning",

      planned_date: "",
      completed_date: "",

      notes: "",
  });

  const { user } = useAuth();

  const queryClient = useQueryClient();

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["project-sites", projectId],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_sites" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("site_code");

      if (error) throw error;

      return data;
    },
  });

  const filteredSites = useMemo(() => {
    return sites.filter((site: any) => {
      const q = search.toLowerCase();

      return (
        site.site_code?.toLowerCase().includes(q) ||
        site.site_name?.toLowerCase().includes(q) ||
        site.city?.toLowerCase().includes(q)
      );
    });
  }, [sites, search]);

  const completedSites = sites.filter(
    (s: any) => s.status === "completed"
  ).length;

  const totalDevices = sites.reduce(
    (sum: number, s: any) => sum + Number(s.device_count || 0),
    0
  );

  const resetForm = () => {

      setEditingSite(null);

      setForm({
          site_code: "",
          site_name: "",
          address: "",
          city: "",
          state: "",
          country: "",
          postal_code: "",

          contact_name: "",
          contact_phone: "",
          contact_email: "",

          device_count: 0,

          status: "planning",

          planned_date: "",
          completed_date: "",

          notes: "",
      });

  };

  const createSite = useMutation({

      mutationFn: async () => {

          if (!form.site_name)
              throw new Error("Site name is required.");

          const { error } = await supabase
              .from("project_sites" as any)
              .insert({

                  ...form,

                  project_id: projectId,

                  created_by: user?.id,

                  planned_date:
                      form.planned_date || null,

                  completed_date:
                      form.completed_date || null,

              });

          if (error)
              throw error;

      },

      onSuccess: () => {

          queryClient.invalidateQueries({
              queryKey: ["project-sites", projectId],
          });

          toast.success("Site created");

          setOpen(false);

          resetForm();

      },

      onError: (e: any) =>
          toast.error(e.message),

  });

  const updateSite = useMutation({

      mutationFn: async () => {

          if (!editingSite)
              return;

          const { error } = await supabase
              .from("project_sites" as any)
              .update({

                  ...form,

                  planned_date:
                      form.planned_date || null,

                  completed_date:
                      form.completed_date || null,

              })
              .eq("id", editingSite.id);

          if (error)
              throw error;

      },

      onSuccess: () => {

          queryClient.invalidateQueries({
              queryKey: ["project-sites", projectId],
          });

          toast.success("Site updated");

          setOpen(false);

          resetForm();

      },

      onError: (e: any) =>
          toast.error(e.message),

  });

  return (
    <div className="space-y-6">

      {/* Summary */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <MapPin className="w-8 h-8 text-primary" />

            <div>
              <p className="text-2xl font-bold">
                {sites.length}
              </p>

              <p className="text-sm text-muted-foreground">
                Total Sites
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-success" />

            <div>
              <p className="text-2xl font-bold">
                {completedSites}
              </p>

              <p className="text-sm text-muted-foreground">
                Completed
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-warning" />

            <div>
              <p className="text-2xl font-bold">
                {totalDevices}
              </p>

              <p className="text-sm text-muted-foreground">
                Devices
              </p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Table */}

      <Card>

        <CardHeader className="flex flex-row items-center justify-between">

          <CardTitle>Project Sites</CardTitle>

          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Site
          </Button>

        </CardHeader>

        <CardContent>

          <div className="relative mb-4">

            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />

            <Input
              className="pl-9"
              placeholder="Search by code, name or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

          </div>

          {isLoading ? (

            <p className="text-muted-foreground">
              Loading sites...
            </p>

          ) : filteredSites.length === 0 ? (

            <div className="text-center py-12">

              <MapPin className="w-12 h-12 mx-auto opacity-30 mb-3" />

              <p className="text-muted-foreground">
                No sites added yet.
              </p>

            </div>

          ) : (

            <Table>

              <TableHeader>

                <TableRow>

                  <TableHead>Code</TableHead>

                  <TableHead>Site Name</TableHead>

                  <TableHead>City</TableHead>

                  <TableHead>Devices</TableHead>

                  <TableHead>Status</TableHead>

                  <TableHead className="w-[70px]">
                    Actions
                  </TableHead>

                </TableRow>

              </TableHeader>

              <TableBody>

                {filteredSites.map((site: any) => (

                  <TableRow key={site.id}>

                    <TableCell className="font-mono text-xs">
                      {site.site_code}
                    </TableCell>

                    <TableCell className="font-medium">
                      {site.site_name}
                    </TableCell>

                    <TableCell>
                      {site.city || "—"}
                    </TableCell>

                    <TableCell>
                      {site.device_count}
                    </TableCell>

                    <TableCell>

                      <Badge
                        className={
                          STATUS_COLORS[site.status] ??
                          "bg-muted"
                        }
                      >
                        {site.status}
                      </Badge>

                    </TableCell>

                    <TableCell>

                      <DropdownMenu>

                        <DropdownMenuTrigger asChild>

                          <Button
                            variant="ghost"
                            size="icon"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>

                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">

                          <DropdownMenuItem
                            onClick={() => {

                                setEditingSite(site);

                                setForm({

                                    site_code: site.site_code ?? "",

                                    site_name: site.site_name ?? "",

                                    address: site.address ?? "",

                                    city: site.city ?? "",

                                    state: site.state ?? "",

                                    country: site.country ?? "",

                                    postal_code: site.postal_code ?? "",

                                    contact_name: site.contact_name ?? "",

                                    contact_phone: site.contact_phone ?? "",

                                    contact_email: site.contact_email ?? "",

                                    device_count: site.device_count ?? 0,

                                    status: site.status ?? "planning",

                                    planned_date: site.planned_date ?? "",

                                    completed_date: site.completed_date ?? "",

                                    notes: site.notes ?? "",

                                });

                                setOpen(true);

                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>

                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>

                        </DropdownMenuContent>

                      </DropdownMenu>

                    </TableCell>

                  </TableRow>

                ))}

              </TableBody>

            </Table>

          )}

        </CardContent>

      </Card>

      <Dialog
          open={open}
          onOpenChange={(value) => {
              setOpen(value);

              if (!value)
                  resetForm();
          }}
      >

          <DialogContent className="max-w-3xl">

              <DialogHeader>

                  <DialogTitle>

                      {editingSite
                          ? "Edit Site"
                          : "Add Site"}

                  </DialogTitle>

              </DialogHeader>

              <div className="grid grid-cols-2 gap-4">

                  <div>

                      <Label>Site Code</Label>

                      <Input
                          value={form.site_code}
                          onChange={(e) =>
                              setForm({
                                  ...form,
                                  site_code: e.target.value,
                              })
                          }
                      />

                  </div>

                  <div>

                      <Label>Site Name *</Label>

                      <Input
                          value={form.site_name}
                          onChange={(e) =>
                              setForm({
                                  ...form,
                                  site_name: e.target.value,
                              })
                          }
                      />

                  </div>

                  <div className="col-span-2">

                      <Label>Address</Label>

                      <Input
                          value={form.address}
                          onChange={(e) =>
                              setForm({
                                  ...form,
                                  address: e.target.value,
                              })
                          }
                      />

                  </div>

                  <div>

                      <Label>City</Label>

                      <Input
                          value={form.city}
                          onChange={(e) =>
                              setForm({
                                  ...form,
                                  city: e.target.value,
                              })
                          }
                      />

                  </div>

                  <div>

                      <Label>State</Label>

                      <Input
                          value={form.state}
                          onChange={(e) =>
                              setForm({
                                  ...form,
                                  state: e.target.value,
                              })
                          }
                      />

                  </div>

                  <div>

                      <Label>Country</Label>

                      <Input
                          value={form.country}
                          onChange={(e) =>
                              setForm({
                                  ...form,
                                  country: e.target.value,
                              })
                          }
                      />

                  </div>

                  <div>

                      <Label>Devices</Label>

                      <Input
                          type="number"
                          value={form.device_count}
                          onChange={(e) =>
                              setForm({
                                  ...form,
                                  device_count: Number(e.target.value),
                              })
                          }
                      />

                  </div>

                  <div>

                      <Label>Status</Label>

                      <Select
                          value={form.status}
                          onValueChange={(value) =>
                              setForm({
                                  ...form,
                                  status: value,
                              })
                          }
                      >

                          <SelectTrigger>

                              <SelectValue />

                          </SelectTrigger>

                          <SelectContent>

                              <SelectItem value="planning">
                                  Planning
                              </SelectItem>

                              <SelectItem value="assigned">
                                  Assigned
                              </SelectItem>

                              <SelectItem value="installation">
                                  Installation
                              </SelectItem>

                              <SelectItem value="testing">
                                  Testing
                              </SelectItem>

                              <SelectItem value="completed">
                                  Completed
                              </SelectItem>

                          </SelectContent>

                      </Select>

                  </div>

                  <div className="col-span-2">

                      <Label>Notes</Label>

                      <Textarea
                          rows={4}
                          value={form.notes}
                          onChange={(e) =>
                              setForm({
                                  ...form,
                                  notes: e.target.value,
                              })
                          }
                      />

                  </div>

              </div>

              <DialogFooter>

                  <Button
                      onClick={() => {

                          if (editingSite)
                              updateSite.mutate();
                          else
                              createSite.mutate();

                      }}
                  >
                      {editingSite
                          ? "Update Site"
                          : "Create Site"}
                  </Button>

              </DialogFooter>

          </DialogContent>

      </Dialog>

    </div>
  );
};

export default ProjectSites;