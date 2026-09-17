package com.doezip.learning;

import com.doezip.learning.service.FlowTasks;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class FlowTasksTest {
 @Test void keepsLegacyCopyAndUsesV2ForTheCatalog(){
  assertThat(FlowTasks.get("REPORT",FlowTasks.LEGACY_VERSION,false).title()).isEqualTo("결제 지연 상황을 동료에게 설명하기");
  assertThat(FlowTasks.get("REPORT",false).title()).isEqualTo("결제 지연 대응안을 운영 리드에게 제안하기");
  assertThat(FlowTasks.codingTaskVersion(FlowTasks.LEGACY_VERSION)).isEqualTo("duplicate-items-v1");
  assertThat(FlowTasks.codingTaskVersion(FlowTasks.CURRENT_VERSION)).isEqualTo("duplicate-items-v2");
 }
}
