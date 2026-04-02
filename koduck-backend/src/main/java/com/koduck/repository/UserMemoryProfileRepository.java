package com.koduck.repository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.UserMemoryProfile;

@Repository
public interface UserMemoryProfileRepository extends JpaRepository<UserMemoryProfile, Long> {
}
