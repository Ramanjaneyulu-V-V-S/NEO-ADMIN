package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DigidakReportServiceTest {

    @Mock private DctmConfig dctmConfig;
    @Mock private RestClient.Builder restClientBuilder;
    @Mock private RestClient restClient;
    @Mock private RestClient.ResponseSpec responseSpec;

    private DigidakReportService service;

    @BeforeEach
    void setUp() {
        when(restClientBuilder.build()).thenReturn(restClient);
        service = new DigidakReportService(dctmConfig, restClientBuilder);
        when(dctmConfig.getUrl()).thenReturn("https://localhost:3030/dctm-rest");
        when(dctmConfig.getRepository()).thenReturn("NABARDUAT");
        when(dctmConfig.getUsername()).thenReturn("dmadmin");
        when(dctmConfig.getPassword()).thenReturn("password");

        var getSpec = mock(RestClient.RequestHeadersUriSpec.class);
        doReturn(getSpec).when(restClient).get();
        doReturn(getSpec).when(getSpec).uri(anyString(), any(Object[].class));
        doReturn(getSpec).when(getSpec).header(anyString(), anyString());
        doReturn(responseSpec).when(getSpec).retrieve();
    }

    private Map<String, Object> countResponse(long count) {
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("cnt", count);
        return Map.of("entries", List.of(Map.of("content", Map.of("properties", props))));
    }

    private Map<String, Object> groupResponse(String catField, String valField, Object[][] data) {
        var entries = new ArrayList<Map<String, Object>>();
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
        when(responseSpec.body(Map.class)).thenReturn(countResponse(1000));
        Map<String, Object> result = service.getSummary(Map.of());
        assertNotNull(result);
        assertEquals(1000L, result.get("total"));
    }

    @Test
    void getSummary_withFilters() {
        when(responseSpec.body(Map.class)).thenReturn(countResponse(50));
        Map<String, Object> result = service.getSummary(Map.of("loginOfficeType", "HO", "decision", "Inward"));
        assertNotNull(result);
        assertEquals(50L, result.get("total"));
    }

    @Test
    void getByStatus_returnsGroupedData() {
        when(responseSpec.body(Map.class)).thenReturn(groupResponse("status", "cnt", new Object[][]{
                {"Unread", 200L}, {"Assigned", 150L}, {"Closed", 80L}
        }));
        List<Map<String, Object>> result = service.getByStatus(Map.of());
        assertEquals(3, result.size());
        assertEquals("Unread", result.get(0).get("category"));
        assertEquals(200L, result.get(0).get("value"));
    }

    @Test
    void getByNature_returnsGroupedData() {
        when(responseSpec.body(Map.class)).thenReturn(groupResponse("nature_of_correspondence", "cnt", new Object[][]{
                {"Circular", 300L}, {"Letter", 200L}
        }));
        List<Map<String, Object>> result = service.getByNature(Map.of());
        assertEquals(2, result.size());
        assertEquals("Circular", result.get(0).get("category"));
    }

    @Test
    void getByVertical_returnsTop20() {
        when(responseSpec.body(Map.class)).thenReturn(groupResponse("vertical", "cnt", new Object[][]{
                {"FSDD", 120L}, {"BID", 95L}
        }));
        List<Map<String, Object>> result = service.getByVertical(Map.of());
        assertEquals(2, result.size());
        assertEquals("FSDD", result.get(0).get("category"));
    }

    @Test
    void getTrend_returnsMonthlyData() {
        when(responseSpec.body(Map.class)).thenReturn(groupResponse("month", "cnt", new Object[][]{
                {"2026-01", 45L}, {"2026-02", 52L}
        }));
        List<Map<String, Object>> result = service.getTrend(Map.of());
        assertEquals(2, result.size());
        assertEquals("2026-01", result.get(0).get("category"));
    }

    @Test
    void getByDecision_returnsInwardOutward() {
        when(responseSpec.body(Map.class)).thenReturn(groupResponse("decision", "cnt", new Object[][]{
                {"Inward", 600L}, {"Outward", 400L}
        }));
        List<Map<String, Object>> result = service.getByDecision(Map.of());
        assertEquals(2, result.size());
        assertEquals("Inward", result.get(0).get("category"));
    }

    @Test
    void getByStatus_emptyResponse() {
        when(responseSpec.body(Map.class)).thenReturn(Map.of("entries", List.of()));
        List<Map<String, Object>> result = service.getByStatus(Map.of());
        assertTrue(result.isEmpty());
    }

    @Test
    void getByStatus_nullResponse() {
        when(responseSpec.body(Map.class)).thenReturn(null);
        List<Map<String, Object>> result = service.getByStatus(Map.of());
        assertTrue(result.isEmpty());
    }
}
