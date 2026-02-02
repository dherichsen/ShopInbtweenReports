-- AlterTable
ALTER TABLE "report_jobs" ADD COLUMN     "csv_data" BYTEA,
ADD COLUMN     "pdf_data" BYTEA,
ADD COLUMN     "xlsx_data" BYTEA;
