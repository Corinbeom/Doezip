package com.doezip.shared;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain security(HttpSecurity http, ObjectMapper mapper,
            @Value("${app.cors-allowed-origin}") String origin) throws Exception {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(List.of(origin));
        cors.setAllowedMethods(List.of("GET"));
        cors.setAllowedHeaders(List.of("Accept", "Content-Type"));
        cors.setExposedHeaders(List.of("X-Request-Id"));
        cors.setAllowCredentials(false);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/actuator/health", cors);
        source.registerCorsConfiguration("/api/v1/tasks", cors);
        source.registerCorsConfiguration("/api/v1/tasks/*", cors);
        CorsConfiguration me = new CorsConfiguration(cors);
        me.setAllowedHeaders(List.of("Accept", "Content-Type", "Authorization"));
        source.registerCorsConfiguration("/api/v1/me", me);
        CorsConfiguration bootstrap = new CorsConfiguration(me);
        bootstrap.setAllowedMethods(List.of("POST"));
        source.registerCorsConfiguration("/api/v1/me/bootstrap", bootstrap);
        org.springframework.security.web.AuthenticationEntryPoint unauthorized = (request, response, exception) -> {
            response.setStatus(401); response.setContentType("application/json");
            response.setHeader("WWW-Authenticate", "Bearer");
            response.setHeader("Cache-Control", "no-store");
            mapper.writeValue(response.getOutputStream(), new ApiError("UNAUTHORIZED", "인증이 필요합니다.", RequestIdFilter.id(request)));
        };
        return http.csrf(c -> c.ignoringRequestMatchers(org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/v1/me/bootstrap")))
            .oauth2ResourceServer(c -> c.jwt(jwt -> {}).authenticationEntryPoint(unauthorized))
            .cors(c -> c.configurationSource(source))
            .sessionManagement(c -> c.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .formLogin(AbstractHttpConfigurer::disable).httpBasic(AbstractHttpConfigurer::disable)
            .requestCache(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(c -> c.requestMatchers(HttpMethod.GET, "/actuator/health", "/api/v1/tasks", "/api/v1/tasks/*").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/me").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/v1/me/bootstrap").authenticated()
                .anyRequest().denyAll())
            .exceptionHandling(c -> c
                .authenticationEntryPoint(unauthorized)
                .accessDeniedHandler((request, response, exception) -> {
                    response.setStatus(403); response.setContentType("application/json");
                    mapper.writeValue(response.getOutputStream(), new ApiError("FORBIDDEN", "접근할 수 없습니다.", RequestIdFilter.id(request)));
                }))
            .build();
    }
}
