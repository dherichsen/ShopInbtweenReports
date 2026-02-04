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

// Get shop from URL
const getShop = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('shop') || 'shopinbtweenproduction.myshopify.com';
};

function App() {
  const shop = getShop();
  
  // Default to last 30 days
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
      const response = await window.fetch(`/api/report-jobs?shop=${encodeURIComponent(shop)}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      }
    } catch (err) {
      console.error("Error loading jobs:", err);
    }
  };

  const handleGenerateReport = async (reportType = "standard") => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await window.fetch(`/api/report-jobs?shop=${encodeURIComponent(shop)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
          financialStatus,
          fulfillmentStatus,
          reportType,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate report");
      }
      
      await loadJobs();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (jobId, format) => {
    try {
      const response = await window.fetch(`/api/report-jobs/${jobId}/download.${format}?shop=${encodeURIComponent(shop)}`);
      const blob = await response.blob();

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const params = JSON.parse(jobs.find(j => j.id === jobId)?.paramsJson || "{}");
      const reportType = params.reportType || "standard";
      let filename = `report-${jobId}.${format}`;
      if (reportType === "qb") {
        filename = `qb-report-${jobId}.${format}`;
      } else if (reportType === "internal_vendors") {
        filename = `internal-vendors-report-${jobId}.${format}`;
      }
      link.setAttribute("download", filename);
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
    const reportTypeParam = params.reportType || "standard";
    let reportType = "Standard";
    if (reportTypeParam === "qb") {
      reportType = "Quickbooks";
    } else if (reportTypeParam === "internal_vendors") {
      reportType = "Internal Vendors";
    }
    return [
      new Date(job.createdAt).toLocaleString(),
      `${params.startDate} to ${params.endDate}`,
      reportType,
      getStatusBadge(job.status),
      job.status === "COMPLETE" ? (
        <div style={{ display: "flex", gap: "8px" }}>
          {job.hasCsvData && (
            <Button size="slim" onClick={() => handleDownload(job.id, "csv")}>
              CSV
            </Button>
          )}
          {job.hasXlsxData && (
            <Button size="slim" onClick={() => handleDownload(job.id, "xlsx")}>
              XLSX
            </Button>
          )}
          {job.hasPdfData && (
            <Button size="slim" onClick={() => handleDownload(job.id, "pdf")}>
              PDF
            </Button>
          )}
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
                selected={{ start: startDate, end: startDate }}
                onMonthChange={(month, year) => {
                  const newDate = new Date(startDate);
                  newDate.setFullYear(year, month);
                  setStartDate(newDate);
                }}
                onChange={(range) => setStartDate(range.start)}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                End Date
              </Text>
              <DatePicker
                month={endDate.getMonth()}
                year={endDate.getFullYear()}
                selected={{ start: endDate, end: endDate }}
                onMonthChange={(month, year) => {
                  const newDate = new Date(endDate);
                  newDate.setFullYear(year, month);
                  setEndDate(newDate);
                }}
                onChange={(range) => setEndDate(range.start)}
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

            <div style={{ display: "flex", gap: "12px" }}>
              <Button
                onClick={() => handleGenerateReport("qb")}
                loading={isGenerating}
                disabled={isGenerating}
              >
                QB Report
              </Button>
              <Button
                onClick={() => handleGenerateReport("internal_vendors")}
                loading={isGenerating}
                disabled={isGenerating}
              >
                Internal Vendors
              </Button>
            </div>
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
                  columnContentTypes={["text", "text", "text", "text", "text"]}
                  headings={["Created", "Date Range", "Report Type", "Status", "Actions"]}
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

