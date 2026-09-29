package com.example.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import lombok.Data;

@Configuration
@ConfigurationProperties(prefix = "app")
@Data
public class AppConfig {
    private CasesConfig cases = new CasesConfig();
    private WorkflowConfig workflow = new WorkflowConfig();
    private SfsConfig sfs = new SfsConfig();

    @Data
    public static class CasesConfig {
        /**
         * Number of months to load cases by default when no search term is provided
         */
        private int defaultLoadMonths = 3;
    }

    @Data
    public static class WorkflowConfig {
        private String processes;
    }

    @Data
    public static class SfsConfig {
        /**
         * Folder ID (r_object_id) for /SFS Config/Document Type
         * Get from query: SELECT r_object_id FROM dm_folder WHERE ANY r_folder_path = '/SFS Config/Document Type'
         */
        private String documentTypeFolderId;
    }
}
