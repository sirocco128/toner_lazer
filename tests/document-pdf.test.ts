import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  A4_FIT_SLACK_MM,
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  a4PageHeightPx,
  a4ShouldFitOnePage,
  a4SinglePageSize,
  a4SliceRanges,
  canvasHeightMm,
  pdfDownloadName,
} from "../lib/document-pdf";

describe("document PDF helpers", () => {
  it("maps canvas width to one A4 page height", () => {
    const width = 794;
    const pageH = a4PageHeightPx(width);
    assert.equal(pageH, Math.round((width * A4_HEIGHT_MM) / A4_WIDTH_MM));
  });

  it("keeps a short sheet on one page", () => {
    const slices = a4SliceRanges(794, 400);
    assert.equal(slices.length, 1);
    assert.equal(slices[0]?.y, 0);
    assert.equal(slices[0]?.height, 400);
  });

  it("splits a tall sheet across A4 pages", () => {
    const width = 794;
    const pageH = a4PageHeightPx(width);
    const slices = a4SliceRanges(width, pageH * 2 + 80);
    assert.equal(slices.length, 3);
    assert.equal(slices[0]?.height, pageH);
    assert.equal(slices[2]?.height, 80);
  });

  it("drops a sliver leftover instead of a blank extra page", () => {
    const width = 794;
    const pageH = a4PageHeightPx(width);
    const slices = a4SliceRanges(width, pageH + 8);
    assert.equal(slices.length, 1);
    assert.equal(slices[0]?.height, pageH);
  });

  it("fits a short or slightly tall sheet on one A4 page", () => {
    const width = 794;
    const pageH = a4PageHeightPx(width);
    assert.equal(a4ShouldFitOnePage(width, 400), true);
    assert.equal(a4ShouldFitOnePage(width, pageH), true);
    const slackPx = Math.floor((A4_FIT_SLACK_MM * width) / A4_WIDTH_MM) - 1;
    assert.equal(a4ShouldFitOnePage(width, pageH + slackPx), true);
    assert.equal(a4ShouldFitOnePage(width, pageH * 2), false);
    const fitted = a4SinglePageSize(width, pageH + slackPx);
    assert.ok(fitted.heightMm <= A4_HEIGHT_MM + 0.01);
    assert.ok(fitted.widthMm <= A4_WIDTH_MM + 0.01);
    assert.ok(canvasHeightMm(width, 400) < A4_HEIGHT_MM);
  });

  it("sanitizes download names", () => {
    assert.equal(pdfDownloadName("RV-20260904-2B711E1E"), "RV-20260904-2B711E1E.pdf");
    assert.equal(pdfDownloadName("ใบรับเงิน RV/1"), "RV_1.pdf");
    assert.equal(pdfDownloadName("***"), "document.pdf");
  });
});
