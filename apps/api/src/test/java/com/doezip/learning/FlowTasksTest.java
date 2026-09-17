package com.doezip.learning;

import com.doezip.learning.service.FlowTasks;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FlowTasksTest {
 @Test void keepsLegacyCopyAndUsesV2ForTheCatalog(){
  assertThat(FlowTasks.get(FlowTasks.REPORT_CATALOG_ID,FlowTasks.LEGACY_VERSION,false).title()).isEqualTo("결제 지연 상황을 동료에게 설명하기");
  assertThat(FlowTasks.get(FlowTasks.REPORT_CATALOG_ID,FlowTasks.CURRENT_VERSION,false).title()).isEqualTo("결제 지연 대응안을 운영 리드에게 제안하기");
 assertThat(FlowTasks.codingTaskVersion(FlowTasks.CODING_CATALOG_ID,FlowTasks.LEGACY_VERSION)).isEqualTo("duplicate-items-v1");
 assertThat(FlowTasks.codingTaskVersion(FlowTasks.CODING_CATALOG_ID,FlowTasks.CURRENT_VERSION)).isEqualTo("duplicate-items-v2");
 }
 @Test void exposesNewTasksWithExactIdentityAndNoPublicHints(){
  assertThat(FlowTasks.catalog(false)).hasSize(4).allSatisfy(task->assertThat(task.hints()).isEmpty());
  assertThat(FlowTasks.get(FlowTasks.ACTIVATION_CATALOG_ID,FlowTasks.ACTIVATION_VERSION,false).title()).contains("활성화 하락");
  assertThat(FlowTasks.reportTaskId(FlowTasks.ACTIVATION_CATALOG_ID,FlowTasks.ACTIVATION_VERSION)).isEqualTo(FlowTasks.ACTIVATION_ID);
  assertThat(FlowTasks.get(FlowTasks.RETRY_CATALOG_ID,FlowTasks.RETRY_VERSION,false).title()).contains("재시도 조건");
  assertThat(FlowTasks.codingTaskVersion(FlowTasks.RETRY_CATALOG_ID,FlowTasks.RETRY_VERSION)).isEqualTo("retry-policy-v1");
  assertThatThrownBy(()->FlowTasks.get(FlowTasks.RETRY_CATALOG_ID,FlowTasks.CURRENT_VERSION,false)).isInstanceOf(com.doezip.task.service.TaskNotFoundException.class);
  assertThatThrownBy(()->FlowTasks.get(FlowTasks.ACTIVATION_CATALOG_ID,FlowTasks.CURRENT_VERSION,false)).isInstanceOf(com.doezip.task.service.TaskNotFoundException.class);
 }
}
