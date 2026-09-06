import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import AppLayout from "@/components/layout/AppLayout";
import ProjectSites from "@/pages/ProjectSites";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";

import {
    Badge,
} from "@/components/ui/badge";

import {
    Calendar,
    Building2,
    FolderKanban,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
    planning: "bg-muted text-muted-foreground",
    in_progress: "bg-primary/15 text-primary",
    on_hold: "bg-warning/15 text-warning",
    completed: "bg-success/15 text-success",
    cancelled: "bg-destructive/15 text-destructive",
};

export default function ProjectDetails() {

    const { projectId } = useParams();

    const { data: project, isLoading } = useQuery({
        queryKey: ["project", projectId],
        queryFn: async () => {

            const { data, error } = await supabase
                .from("projects")
                .select(`
                    *,
                    clients(company_name),
                    partners(company_name)
                `)
                .eq("id", projectId)
                .single();

            if (error) throw error;

            return data;
        },
    });

    if (isLoading)
        return (
            <AppLayout title="Project">
                Loading...
            </AppLayout>
        );

    if (!project)
        return (
            <AppLayout title="Project">
                Project not found.
            </AppLayout>
        );

    return (

        <AppLayout
            title={project.name}
            subtitle={project.code ?? ""}
        >

            <div className="space-y-6">

                <Card>

                    <CardHeader>

                        <CardTitle className="flex items-center justify-between">

                            <span>{project.name}</span>

                            <Badge
                                className={
                                    STATUS_COLORS[project.status] ?? ""
                                }
                            >
                                {project.status.replace("_", " ")}
                            </Badge>

                        </CardTitle>

                    </CardHeader>

                    <CardContent>

                        <div className="grid md:grid-cols-4 gap-6">

                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Client
                                </p>

                                <div className="flex items-center gap-2 mt-1">

                                    <Building2 className="w-4 h-4" />

                                    {project.clients?.company_name ?? "-"}

                                </div>

                            </div>

                            <div>

                                <p className="text-sm text-muted-foreground">
                                    Partner
                                </p>

                                <p className="mt-1">
                                    {project.partners?.company_name ?? "-"}
                                </p>

                            </div>

                            <div>

                                <p className="text-sm text-muted-foreground">
                                    Start Date
                                </p>

                                <div className="flex items-center gap-2 mt-1">

                                    <Calendar className="w-4 h-4" />

                                    {project.start_date ?? "-"}

                                </div>

                            </div>

                            <div>

                                <p className="text-sm text-muted-foreground">
                                    Budget
                                </p>

                                <p className="mt-1">

                                    {project.currency} {project.budget}

                                </p>

                            </div>

                        </div>

                    </CardContent>

                </Card>

                <Tabs defaultValue="overview">

                    <TabsList>

                        <TabsTrigger value="overview">
                            Overview
                        </TabsTrigger>

                        <TabsTrigger value="sites">
                            Sites
                        </TabsTrigger>

                        <TabsTrigger value="devices">
                            Devices
                        </TabsTrigger>

                        <TabsTrigger value="documents">
                            Documents
                        </TabsTrigger>

                        <TabsTrigger value="budget">
                            Budget
                        </TabsTrigger>

                        <TabsTrigger value="notes">
                            Notes
                        </TabsTrigger>

                    </TabsList>

                    <TabsContent value="overview">

                        <Card>

                            <CardHeader>

                                <CardTitle>
                                    Project Overview
                                </CardTitle>

                            </CardHeader>

                            <CardContent>

                                <div className="grid md:grid-cols-3 gap-4">

                                    <Card>

                                        <CardContent className="p-6">

                                            <FolderKanban className="mb-2 h-6 w-6" />

                                            <h2 className="text-2xl font-bold">
                                                {project.total_sites}
                                            </h2>

                                            <p>Total Sites</p>

                                        </CardContent>

                                    </Card>

                                    <Card>

                                        <CardContent className="p-6">

                                            <h2 className="text-2xl font-bold">
                                                {project.completed_sites}
                                            </h2>

                                            <p>Completed Sites</p>

                                        </CardContent>

                                    </Card>

                                    <Card>

                                        <CardContent className="p-6">

                                            <h2 className="text-2xl font-bold">
                                                {project.total_devices}
                                            </h2>

                                            <p>Total Devices</p>

                                        </CardContent>

                                    </Card>

                                </div>

                            </CardContent>

                        </Card>

                    </TabsContent>

                    <TabsContent value="sites">

                        <ProjectSites projectId={project.id} />

                    </TabsContent>

                    <TabsContent value="devices">

                        <Card>

                            <CardContent className="p-8 text-center">

                                🚧 Devices module coming later

                            </CardContent>

                        </Card>

                    </TabsContent>

                    <TabsContent value="documents">

                        <Card>

                            <CardContent className="p-8 text-center">

                                🚧 Documents module coming later

                            </CardContent>

                        </Card>

                    </TabsContent>

                    <TabsContent value="budget">

                        <Card>

                            <CardContent className="p-8 text-center">

                                🚧 Budget module coming later

                            </CardContent>

                        </Card>

                    </TabsContent>

                    <TabsContent value="notes">

                        <Card>

                            <CardContent className="p-8">

                                {project.notes || "No notes"}

                            </CardContent>

                        </Card>

                    </TabsContent>

                </Tabs>

            </div>

        </AppLayout>

    );

}