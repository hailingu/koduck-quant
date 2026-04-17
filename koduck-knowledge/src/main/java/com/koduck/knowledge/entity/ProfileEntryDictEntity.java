package com.koduck.knowledge.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "profile_entry_dict")
public class ProfileEntryDictEntity {

    @Id
    @Column(name = "profile_entry_id", nullable = false)
    private Integer profileEntryId;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "is_basic", nullable = false)
    private boolean isBasic;

    public Integer getProfileEntryId() {
        return profileEntryId;
    }

    public void setProfileEntryId(final Integer profileEntryId) {
        this.profileEntryId = profileEntryId;
    }

    public String getCode() {
        return code;
    }

    public void setCode(final String code) {
        this.code = code;
    }

    public boolean isBasic() {
        return isBasic;
    }

    public void setBasic(final boolean basic) {
        isBasic = basic;
    }
}
