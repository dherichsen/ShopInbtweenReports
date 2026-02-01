import React, { useState, useEffect } from "react";
import {
  Page,
  Card,
  Layout,
  Button,
  DatePicker,
  Select,
  Banner,
  Spinner,
  DataTable,
  Badge,
  EmptyState,
  Text,
} from "@shopify/polaris";
import axios from "axios";

// Configure axios to send cookies with requests
axios.defaults.withCredentials = true;

function App() {
  // Default to last 30 days (fix year to current year)
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 30);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(new Date());
  const [financialStatus, setFinancialStatus] = useState(["paid", "partially_paid"]);
  const [fulfillmentStatus, setFulfillmentStatus] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);

  useEffect(() => {
    console.log("🔄 [FRONTEND] useEffect - Setting up polling");
    loadJobs();
    
    // Poll for job updates every 3 seconds - but only if we have jobs or are generating
    const interval = setInterval(() => {
      // Only poll if we have jobs or are generating a report
      if (jobs.length > 0 || isGenerating) {
        console.log("🔄 [FRONTEND] Polling interval fired - calling loadJobs()");
        loadJobs();
      } else {
        console.log("🔄 [FRONTEND] Skipping poll - no jobs and not generating");
      }
    }, 3000);

    setPollingInterval(interval);
    console.log("🔄 [FRONTEND] Polling interval set, ID:", interval);

    return () => {
      console.log("🔄 [FRONTEND] useEffect cleanup - clearing interval:", interval);
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [jobs.length, isGenerating]); // Re-run if jobs or generating state changes

  const loadJobs = async () => {
    try {
      console.log("🔄 [FRONTEND] loadJobs() called - fetching /api/report-jobs");
      const response = await axios.get("/api/report-jobs");
      console.log("✅ [FRONTEND] loadJobs() response:", response.status, response.data);
      console.log("✅ [FRONTEND] Jobs count:", response.data?.length || 0);
      setJobs(response.data);
    } catch (err) {
      console.error("❌ [FRONTEND] Error loading jobs:", err);
      console.error("❌ [FRONTEND] Error response:", err.response);
    }
  };

  const handleGenerateReport = async () => {
    console.log("🔵 [FRONTEND] Generate Report button clicked");
    console.log("🔵 [FRONTEND] Form data:", {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      financialStatus,
      fulfillmentStatus,
    });
    
    setIsGenerating(true);
    setError(null);

    try {
      console.log("🔵 [FRONTEND] Sending POST request to /api/report-jobs");
      const requestData = {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        financialStatus,
        fulfillmentStatus,
      };
      console.log("🔵 [FRONTEND] Request payload:", JSON.stringify(requestData));
      
      const response = await axios.post("/api/report-jobs", requestData);
      
      console.log("✅ [FRONTEND] POST request successful!");
      console.log("✅ [FRONTEND] Response status:", response.status);
      console.log("✅ [FRONTEND] Response data:", response.data);
      
      await loadJobs();
    } catch (err) {
      console.error("❌ [FRONTEND] Error creating report:");
      console.error("❌ [FRONTEND] Error object:", err);
      console.error("❌ [FRONTEND] Error message:", err.message);
      console.error("❌ [FRONTEND] Error response:", err.response);
      console.error("❌ [FRONTEND] Error response status:", err.response?.status);
      console.error("❌ [FRONTEND] Error response data:", err.response?.data);
      console.error("❌ [FRONTEND] Error response headers:", err.response?.headers);
      
      const errorMessage = err.response?.data?.error || err.message || "Failed to generate report";
      console.error("❌ [FRONTEND] Setting error message:", errorMessage);
      setError(errorMessage);
    } finally {
      console.log("🔵 [FRONTEND] Setting isGenerating to false");
      setIsGenerating(false);
    }
  };

  const handleDownload = async (jobId, format) => {
    try {
      const response = await axios.get(`/api/report-jobs/${jobId}/download.${format}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `report-${jobId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError("Failed to download file");
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      QUEUED: { status: "info", children: "Queued" },
      RUNNING: { status: "attention", children: "Running" },
      COMPLETE: { status: "success", children: "Complete" },
      FAILED: { status: "critical", children: "Failed" },
    };
    return <Badge {...statusMap[status]} />;
  };

  const jobsTableRows = jobs.map((job) => {
    const params = JSON.parse(job.paramsJson);
    return [
      new Date(job.createdAt).toLocaleString(),
      `${params.startDate} to ${params.endDate}`,
      getStatusBadge(job.status),
      job.status === "COMPLETE" ? (
        <div style={{ display: "flex", gap: "8px" }}>
          <Button size="slim" onClick={() => handleDownload(job.id, "csv")}>
            CSV
          </Button>
          <Button size="slim" onClick={() => handleDownload(job.id, "pdf")}>
            PDF
          </Button>
        </div>
      ) : job.status === "FAILED" ? (
        <span style={{ color: "red", fontSize: "12px" }}>{job.errorMessage}</span>
      ) : (
        <Spinner size="small" />
      ),
    ];
  });

  return (
    <Page title="Sales Detail Report">
      <Layout>
        <Layout.Section>
          {error && (
            <Banner status="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          )}

          <Card sectioned>
            <div style={{ marginBottom: "20px" }}>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                Start Date
              </Text>
              <DatePicker
                month={startDate.getMonth()}
                year={startDate.getFullYear()}
                selected={startDate}
                onMonthChange={(month, year) => {
                  const newDate = new Date(startDate);
                  newDate.setFullYear(year, month);
                  setStartDate(newDate);
                }}
                onChange={setStartDate}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                End Date
              </Text>
              <DatePicker
                month={endDate.getMonth()}
                year={endDate.getFullYear()}
                selected={endDate}
                onMonthChange={(month, year) => {
                  const newDate = new Date(endDate);
                  newDate.setFullYear(year, month);
                  setEndDate(newDate);
                }}
                onChange={setEndDate}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <Select
                label="Financial Status"
                options={[
                  { label: "Paid & Partially Paid", value: "paid,partially_paid" },
                  { label: "Paid", value: "paid" },
                  { label: "Partially Paid", value: "partially_paid" },
                  { label: "Any", value: "any" },
                ]}
                value={financialStatus.length === 0 ? "any" : financialStatus.join(",")}
                onChange={(value) => {
                  if (value === "any") {
                    setFinancialStatus([]);
                  } else {
                    setFinancialStatus(value.split(","));
                  }
                }}
              />
            </div>

            <Button
              primary
              onClick={handleGenerateReport}
              loading={isGenerating}
              disabled={isGenerating}
            >
              Generate Report
            </Button>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <h2 style={{ marginBottom: "16px" }}>Report Jobs</h2>
              {jobs.length === 0 ? (
                <EmptyState
                  heading="No reports generated yet"
                  action={{
                    content: "Generate your first report",
                    onAction: handleGenerateReport,
                  }}
                >
                  <p>Select a date range and click "Generate Report" to get started.</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text"]}
                  headings={["Created", "Date Range", "Status", "Actions"]}
                  rows={jobsTableRows}
                />
              )}
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default App;

