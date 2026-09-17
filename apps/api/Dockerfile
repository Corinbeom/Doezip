FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /workspace

COPY apps/api/gradlew ./gradlew
COPY apps/api/gradle ./gradle
COPY apps/api/settings.gradle apps/api/build.gradle ./
RUN chmod +x ./gradlew

COPY apps/api/src ./src
RUN ./gradlew --no-daemon clean bootJar

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
RUN groupadd --system --gid 10001 doezip \
    && useradd --system --uid 10001 --gid doezip --no-create-home doezip
COPY --from=build /workspace/build/libs/doezip-api.jar ./doezip-api.jar

USER doezip
EXPOSE 10000
ENTRYPOINT ["java","-jar","/app/doezip-api.jar"]
