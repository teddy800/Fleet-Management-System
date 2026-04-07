import React, { useEffect, useState } from "react";
import { maintenanceApi } from "@/lib/api";
import { toast } from "sonner";

const Maintenance = () => {
  const [logs, setLogs] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [logsRes, schedulesRes] = await Promise.all([
          maintenanceApi.list(),
          maintenanceApi.schedules(),
        ]);
        setLogs(logsRes.maintenance_logs || []);
        setSchedules(schedulesRes.schedules || []);
      } catch (err) {
        toast.error("Failed to load maintenance data: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Maintenance</h1>
      <div className="mt-4">
        <h2 className="text-lg font-semibold">History ({logs.length})</h2>
      </div>
      <div className="mt-4">
        <h2 className="text-lg font-semibold">Schedules ({schedules.length})</h2>
      </div>
    </div>
  );
};

export default Maintenance;
