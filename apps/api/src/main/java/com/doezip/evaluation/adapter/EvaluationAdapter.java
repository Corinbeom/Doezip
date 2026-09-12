package com.doezip.evaluation.adapter;
import com.fasterxml.jackson.databind.JsonNode;
public interface EvaluationAdapter { JsonNode evaluate(JsonNode snapshot); }
