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

  // Get shop domain from URL or App Bridge
  const getShopDomain = () => {
    // Try to get from URL query params (Shopify embeds apps with ?shop=...)
    const urlParams = new URLSearchParams(window.location.search);
    const shopFromUrl = urlParams.get('shop');
    if (shopFromUrl) {
      return shopFromUrl;
    }
    // Try to get from window.location.hostname (for embedded apps)
    const hostname = window.location.hostname;
    if (hostname.includes('myshopify.com')) {
      return hostname;
    }
    // Fallback: try to extract from referrer or other sources
    return null;
  };

  const loadJobs = async () => {
    try {
      console.log("🔄 [FRONTEND] loadJobs() called - fetching /api/report-jobs");
      const shopDomain = getShopDomain();
      const url = shopDomain ? `/api/report-jobs?shop=${encodeURIComponent(shopDomain)}` : "/api/report-jobs";
      console.log("🔄 [FRONTEND] Shop domain:", shopDomain);
      console.log("🔄 [FRONTEND] Request URL:", url);
      const response = await axios.get(url);
      console.log("✅ [FRONTEND] loadJobs() response:", response.status, response.data);
      console.log("✅ [FRONTEND] Jobs count:", response.data?.length || 0);
      setJobs(response.data);
    } catch (err) {
      console.error("❌ [FRONTEND] Error loading jobs:", err);
      console.error("❌ [FRONTEND] Error response:", err.response);
    }
  };

  const handleGenerateReport = async (reportType = "standard") => {
    const reportTypeLabel = reportType === "qb" ? "QB Report" : "Report";
    console.log(`🔵 [FRONTEND] Generate ${reportTypeLabel} button clicked`);
    console.log("🔵 [FRONTEND] Form data:", {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      financialStatus,
      fulfillmentStatus,
      reportType,
    });
    
    setIsGenerating(true);
    setError(null);

    try {
      console.log(`🔵 [FRONTEND] Sending POST request to /api/report-jobs`);
      const requestData = {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        financialStatus,
        fulfillmentStatus,
        reportType,
      };
      console.log("🔵 [FRONTEND] Request payload:", JSON.stringify(requestData));
      
      const shopDomain = getShopDomain();
      const url = shopDomain ? `/api/report-jobs?shop=${encodeURIComponent(shopDomain)}` : "/api/report-jobs";
      console.log("🔵 [FRONTEND] Shop domain:", shopDomain);
      console.log("🔵 [FRONTEND] Request URL:", url);
      const response = await axios.post(url, requestData);
      
      console.log(`✅ [FRONTEND] POST request successful!`);
      console.log("✅ [FRONTEND] Response status:", response.status);
      console.log("✅ [FRONTEND] Response data:", response.data);
      
      await loadJobs();
    } catch (err) {
      console.error(`❌ [FRONTEND] Error creating ${reportTypeLabel}:`);
      console.error("❌ [FRONTEND] Error object:", err);
      console.error("❌ [FRONTEND] Error message:", err.message);
      console.error("❌ [FRONTEND] Error response:", err.response);
      console.error("❌ [FRONTEND] Error response status:", err.response?.status);
      console.error("❌ [FRONTEND] Error response data:", err.response?.data);
      console.error("❌ [FRONTEND] Error response headers:", err.response?.headers);
      
      const errorMessage = err.response?.data?.error || err.message || `Failed to generate ${reportTypeLabel}`;
      console.error("❌ [FRONTEND] Setting error message:", errorMessage);
      setError(errorMessage);
    } finally {
      console.log("🔵 [FRONTEND] Setting isGenerating to false");
      setIsGenerating(false);
    }
  };

  const handleDownload = async (jobId, format) => {
    try {
      const shopDomain = getShopDomain();
      const url = shopDomain 
        ? `/api/report-jobs/${jobId}/download.${format}?shop=${encodeURIComponent(shopDomain)}`
        : `/api/report-jobs/${jobId}/download.${format}`;
      const response = await axios.get(url, {
        responseType: "blob",
      });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
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
    const isQbReport = reportTypeParam === "qb";
    return [
      new Date(job.createdAt).toLocaleString(),
      `${params.startDate} to ${params.endDate}`,
      reportType,
      getStatusBadge(job.status),
      job.status === "COMPLETE" ? (
        <div style={{ display: "flex", gap: "8px" }}>
          {reportTypeParam === "internal_vendors" ? (
            <>
              <Button size="slim" onClick={() => handleDownload(job.id, "csv")}>
                CSV
              </Button>
              <Button size="slim" onClick={() => handleDownload(job.id, "xlsx")}>
                XLSX
              </Button>
            </>
          ) : isQbReport ? (
            <>
              <Button size="slim" onClick={() => handleDownload(job.id, "csv")}>
                CSV
              </Button>
              <Button size="slim" onClick={() => handleDownload(job.id, "xlsx")}>
                XLSX
              </Button>
            </>
          ) : (
            <>
              <Button size="slim" onClick={() => handleDownload(job.id, "csv")}>
                CSV
              </Button>
              <Button size="slim" onClick={() => handleDownload(job.id, "pdf")}>
                PDF
              </Button>
            </>
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

            <div style={{ display: "flex", gap: "12px" }}>
              <Button
                primary
                onClick={() => handleGenerateReport("standard")}
                loading={isGenerating}
                disabled={isGenerating}
                style={{ display: "none" }}
              >
                Generate Report
              </Button>
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

