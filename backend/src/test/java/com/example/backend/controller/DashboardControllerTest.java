package com.example.backend.controller;

import com.example.backend.service.DashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DashboardController.class)
class DashboardControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockitoBean private DashboardService dashboardService;

    @Test
    void summary_returnsKpis() throws Exception {
        when(dashboardService.getSummary()).thenReturn(
                Map.of("totalCases", 500L, "casesThisMonth", 42L, "activeWorkflows", 15L, "activeUsers", 200L));

        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCases").value(500))
                .andExpect(jsonPath("$.casesThisMonth").value(42))
                .andExpect(jsonPath("$.activeWorkflows").value(15))
                .andExpect(jsonPath("$.activeUsers").value(200));
    }

    @Test
    void summary_error_returns500() throws Exception {
        when(dashboardService.getSummary()).thenThrow(new RuntimeException("Connection failed"));

        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void casesByDept_returnsList() throws Exception {
        when(dashboardService.getCasesByDepartment()).thenReturn(List.of(
                Map.of("category", "FSDD", "value", 120L),
                Map.of("category", "BID", "value", 95L)));

        mockMvc.perform(get("/api/dashboard/cases-by-dept"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].category").value("FSDD"))
                .andExpect(jsonPath("$[0].value").value(120));
    }

    @Test
    void casesByStatus_returnsList() throws Exception {
        when(dashboardService.getCasesByStatus()).thenReturn(List.of(
                Map.of("category", "Active", "value", 300L)));

        mockMvc.perform(get("/api/dashboard/cases-by-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("Active"));
    }

    @Test
    void casesByOffice_returnsList() throws Exception {
        when(dashboardService.getCasesByOffice()).thenReturn(List.of(
                Map.of("category", "HO", "value", 400L),
                Map.of("category", "RO", "value", 200L)));

        mockMvc.perform(get("/api/dashboard/cases-by-office"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void casesTrend_returnsList() throws Exception {
        when(dashboardService.getCasesTrend()).thenReturn(List.of(
                Map.of("category", "2026-01", "value", 45L)));

        mockMvc.perform(get("/api/dashboard/cases-trend"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("2026-01"));
    }

    @Test
    void workflowStatus_returnsList() throws Exception {
        when(dashboardService.getWorkflowStatus()).thenReturn(List.of(
                Map.of("category", "Running", "value", 80L),
                Map.of("category", "Finished", "value", 200L)));

        mockMvc.perform(get("/api/dashboard/workflow-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("Running"));
    }

    @Test
    void casesByPriority_returnsList() throws Exception {
        when(dashboardService.getCasesByPriority()).thenReturn(List.of(
                Map.of("category", "High", "value", 50L)));

        mockMvc.perform(get("/api/dashboard/cases-by-priority"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("High"));
    }

    @Test
    void usersByOffice_returnsList() throws Exception {
        when(dashboardService.getUsersByOffice()).thenReturn(List.of(
                Map.of("category", "HO", "value", 500L)));

        mockMvc.perform(get("/api/dashboard/users-by-office"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("HO"));
    }

    @Test
    void usersByOffice_error_returns500() throws Exception {
        when(dashboardService.getUsersByOffice()).thenThrow(new RuntimeException("Query failed"));

        mockMvc.perform(get("/api/dashboard/users-by-office"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false));
    }
}
