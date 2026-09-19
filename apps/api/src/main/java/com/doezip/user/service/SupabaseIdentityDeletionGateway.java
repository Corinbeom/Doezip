package com.doezip.user.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class SupabaseIdentityDeletionGateway implements IdentityDeletionGateway {
    private final HttpClient client;
    private final String authUrl;
    private final String secretKey;

    public SupabaseIdentityDeletionGateway(
            @Value("${app.auth.admin-url:}") String authUrl,
            @Value("${app.auth.secret-key:}") String secretKey) {
        this.client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        this.authUrl = authUrl.replaceAll("/+$", "");
        this.secretKey = secretKey;
    }

    @Override
    public void delete(String subject, boolean allowMissing) {
        if (authUrl.isBlank() || secretKey.isBlank()) throw new AccountDeletionUnavailableException();
        try {
            URI uri = UriComponentsBuilder.fromUriString(authUrl)
                .pathSegment("admin", "users", subject).build().encode().toUri();
            HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + secretKey)
                .header("apikey", secretKey)
                .header("Content-Type", "application/json")
                .method("DELETE", HttpRequest.BodyPublishers.ofString("{\"should_soft_delete\":false}"))
                .build();
            int status = client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            if ((status < 200 || status >= 300) && !(status == 404 && allowMissing)) throw new AccountDeletionUnavailableException();
        } catch (AccountDeletionUnavailableException exception) {
            throw exception;
        } catch (Exception exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new AccountDeletionUnavailableException(exception);
        }
    }
}
