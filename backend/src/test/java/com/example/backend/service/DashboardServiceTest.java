package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock private DctmConfig dctmConfig;
    @Mock private RestClient.Builder restClientBuilder;
    @Mock private RestClient restClient;
    @Mock private RestClient.ResponseSpec responseSpec;

    private DashboardService dashboardService;
    private RestClient.RequestHeadersUriSpec getSpec;

    @BeforeEach
    void setUp() {
        when(restClientBuilder.build()).thenReturn(restClient);
        dashboardService = new DashboardService(dctmConfig, restClientBuilder);
        when(dctmConfig.getUrl()).thenReturn("https://localhost:3030/dctm-rest");
        when(dctmConfig.getRepository()).thenReturn("NABARDUAT");
        when(dctmConfig.getUsername()).thenReturn("dmadmin");
        when(dctmConfig.getPassword()).thenReturn("password");

        getSpec = mock(RestClient.RequestHeadersUriSpec.class);
        doReturn(getSpec).when(restClient).get();
        doReturn(getSpec).when(getSpec).uri(anyString(), any(Object[].class));
        doReturn(getSpec).when(getSpec).header(anyString(), anyString());
        doReturn(responseSpec).when(getSpec).retrieve();
    }

    private Map<String, Object> buildCountResponse(long count) {
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("cnt", count);
        return Map.of("entries", List.of(Map.of("content", Map.of("properties", props))));
    }

    private Map<String, Object> buildGroupResponse(String catField, String valField, Object[][] data) {
        var entries = new java.util.ArrayList<Map<String, Object>>();
        for (Object[] row : data) {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put(catField, row[0]);
            props.put(valField, row[1]);
            entries.add(Map.of("content", Map.of("properties", props)));
        }
        return Map.of("entries", entries);
    }

    @Test
    void getSummary_returnsCounts() {
        when(responseSpec.body(Map.class)).thenReturn(buildCountResponse(500));

        Map<String, Object> result = dashboardService.getSummary();

        assertNotNull(result);
        assertEquals(500L, result.get("totalCases"));
    }

    @Test
    void getCasesByDepartment_returnsGroupedData() {
        when(responseSpec.body(Map.class)).thenReturn(buildGroupResponse("department_name", "case_count", new Object[][]{
                {"FSDD", 120L}, {"BID", 95L}, {"CPD", 73L}
        }));

        List<Map<String, Object>> result = dashboardService.getCasesByDepartment();

        assertEquals(3, result.size());
        assertEquals("FSDD", result.get(0).get("category"));
        assertEquals(120L, result.get(0).get("value"));
    }

    @Test
    void getCasesByStatus_returnsGroupedData() {
        when(responseSpec.body(Map.class)).thenReturn(buildGroupResponse("status", "case_count", new Object[][]{
                {"Active", 300L}, {"Completed", 150L}
        }));

        List<Map<String, Object>> result = dashboardService.getCasesByStatus();

        assertEquals(2, result.size());
        assertEquals("Active", result.get(0).get("category"));
        assertEquals(300L, result.get(0).get("value"));
    }

    @Test
    void getCasesByOffice_returnsHoRoSplit() {
        when(responseSpec.body(Map.class)).thenReturn(buildGroupResponse("ho_ro", "case_count", new Object[][]{
                {"HO", 400L}, {"RO", 200L}
        }));

        List<Map<String, Object>> result = dashboardService.getCasesByOffice();

        assertEquals(2, result.size());
        assertEquals("HO", result.get(0).get("category"));
        assertEquals("RO", result.get(1).get("category"));
    }

    @Test
    void getCasesTrend_returnsMonthlyData() {
        when(responseSpec.body(Map.class)).thenReturn(buildGroupResponse("month", "case_count", new Object[][]{
                {"2026-01", 45L}, {"2026-02", 52L}, {"2026-03", 38L}
        }));

        List<Map<String, Object>> result = dashboardService.getCasesTrend();

        assertEquals(3, result.size());
        assertEquals("2026-01", result.get(0).get("category"));
        assertEquals(45L, result.get(0).get("value"));
    }

    @Test
    void getWorkflowStatus_mapsStateLabels() {
        when(responseSpec.body(Map.class)).thenReturn(buildGroupResponse("r_runtime_state", "wf_count", new Object[][]{
                {"1", 80L}, {"2", 200L}, {"4", 5L}
        }));

        List<Map<String, Object>> result = dashboardService.getWorkflowStatus();

        assertEquals(3, result.size());
        assertEquals("Running", result.get(0).get("category"));
        assertEquals("Finished", result.get(1).get("category"));
        assertEquals("Terminated", result.get(2).get("category"));
    }

    @Test
    void getUsersByOffice_returnsGroupedData() {
        when(responseSpec.body(Map.class)).thenReturn(buildGroupResponse("office_type", "user_count", new Object[][]{
                {"HO", 500L}, {"RO", 1200L}, {"TE", 80L}
        }));

        List<Map<String, Object>> result = dashboardService.getUsersByOffice();

        assertEquals(3, result.size());
        assertEquals("HO", result.get(0).get("category"));
        assertEquals(500L, result.get(0).get("value"));
    }

    @Test
    void getCasesByDepartment_emptyResponse_returnsEmptyList() {
        when(responseSpec.body(Map.class)).thenReturn(Map.of("entries", List.of()));

        List<Map<String, Object>> result = dashboardService.getCasesByDepartment();

        assertTrue(result.isEmpty());
    }

    @Test
    void getCasesByDepartment_nullResponse_returnsEmptyList() {
        when(responseSpec.body(Map.class)).thenReturn(null);

        List<Map<String, Object>> result = dashboardService.getCasesByDepartment();

        assertTrue(result.isEmpty());
    }
}
