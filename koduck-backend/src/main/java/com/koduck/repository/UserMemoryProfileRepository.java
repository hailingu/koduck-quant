package com.koduck.repository;

import com.koduck.entity.UserMemoryProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserMemoryProfileRepository extends JpaRepository<UserMemoryProfile, Long> {
}
