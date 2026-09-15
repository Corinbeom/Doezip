package com.doezip.coding.adapter;
import com.doezip.coding.dto.CodingDtos.Proposal;
public interface CodingAi {
 boolean available();
 Proposal propose(String context);
}
