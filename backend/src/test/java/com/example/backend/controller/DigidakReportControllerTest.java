package com.example.backend.controller;

import com.example.backend.service.DigidakReportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DigidakReportController.class)
class DigidakReportControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockitoBean private DigidakReportService reportService;

    @Test
    void summary_returnsKpis() throws Exception {
        when(reportService.getSummary(anyMap())).thenReturn(
                Map.of("total", 1000L, "unread", 200L, "opened", 300L, "assigned", 150L, "closed", 80L, "inprocess", 50L));

        mockMvc.perform(get("/api/reports/digidak/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1000))
                .andExpect(jsonPath("$.unread").value(200));
    }

    @Test
    void summary_withFilters() throws Exception {
        when(reportService.getSummary(anyMap())).thenReturn(Map.of("total", 50L));

        mockMvc.perform(get("/api/reports/digidak/summary?loginOfficeType=HO&decision=Inward"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(50));
    }

    @Test
    void byStatus_returnsList() throws Exception {
        when(reportService.getByStatus(anyMap())).thenReturn(List.of(
                Map.of("category", "Unread", "value", 200L),
                Map.of("category", "Assigned", "value", 150L)));

        mockMvc.perform(get("/api/reports/digidak/by-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].category").value("Unread"));
    }

    @Test
    void byNature_returnsList() throws Exception {
        when(reportService.getByNature(anyMap())).thenReturn(List.of(
                Map.of("category", "Circular", "value", 300L)));

        mockMvc.perform(get("/api/reports/digidak/by-nature"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("Circular"));
    }

    @Test
    void byVertical_returnsList() throws Exception {
        when(reportService.getByVertical(anyMap())).thenReturn(List.of(
                Map.of("category", "FSDD", "value", 120L)));

        mockMvc.perform(get("/api/reports/digidak/by-vertical"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("FSDD"));
    }

    @Test
    void trend_returnsList() throws Exception {
        when(reportService.getTrend(anyMap())).thenReturn(List.of(
                Map.of("category", "2026-01", "value", 45L)));

        mockMvc.perform(get("/api/reports/digidak/trend"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("2026-01"));
    }

    @Test
    void byDecision_returnsList() throws Exception {
        when(reportService.getByDecision(anyMap())).thenReturn(List.of(
                Map.of("category", "Inward", "value", 600L)));

        mockMvc.perform(get("/api/reports/digidak/by-decision"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("Inward"));
    }

    @Test
    void summary_error_returns500() throws Exception {
        when(reportService.getSummary(anyMap())).thenThrow(new RuntimeException("Connection failed"));

        mockMvc.perform(get("/api/reports/digidak/summary"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void bySecrecy_returnsList() throws Exception {
        when(reportService.getBySecrecy(anyMap())).thenReturn(List.of(
                Map.of("category", "Regular", "value", 800L)));

        mockMvc.perform(get("/api/reports/digidak/by-secrecy"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("Regular"));
    }

    @Test
    void byLanguage_returnsList() throws Exception {
        when(reportService.getByLanguage(anyMap())).thenReturn(List.of(
                Map.of("category", "English", "value", 500L)));

        mockMvc.perform(get("/api/reports/digidak/by-language"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("English"));
    }
}
