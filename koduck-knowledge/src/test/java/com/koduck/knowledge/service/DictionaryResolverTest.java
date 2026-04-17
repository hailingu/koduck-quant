package com.koduck.knowledge.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import com.koduck.knowledge.entity.DomainDictEntity;
import com.koduck.knowledge.entity.ProfileEntryDictEntity;
import com.koduck.knowledge.exception.KnowledgeException;
import com.koduck.knowledge.repository.DomainDictRepository;
import com.koduck.knowledge.repository.ProfileEntryDictRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DictionaryResolverTest {

    @Mock
    private DomainDictRepository domainDictRepository;

    @Mock
    private ProfileEntryDictRepository profileEntryDictRepository;

    private DictionaryResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new DictionaryResolver(domainDictRepository, profileEntryDictRepository);
    }

    @Test
    void shouldResolveDomainClass() {
        final DomainDictEntity entity = new DomainDictEntity();
        entity.setDomainClass("finance");
        when(domainDictRepository.findByDomainClass("finance")).thenReturn(Optional.of(entity));

        assertEquals("finance", resolver.resolveDomainClass("finance").getDomainClass());
    }

    @Test
    void shouldResolveOnlyNonBasicEntries() {
        final ProfileEntryDictEntity bio = new ProfileEntryDictEntity();
        bio.setProfileEntryId(2);
        bio.setCode("BIO");
        bio.setBasic(false);
        when(profileEntryDictRepository.findByCode("BIO")).thenReturn(Optional.of(bio));

        assertEquals(List.of("BIO"), resolver.resolveNonBasicProfileEntryCodes(List.of("bio")).stream()
                .map(ProfileEntryDictEntity::getCode)
                .toList());
    }

    @Test
    void shouldFailWhenBasicPassedAsNonBasic() {
        final ProfileEntryDictEntity basic = new ProfileEntryDictEntity();
        basic.setProfileEntryId(1);
        basic.setCode("BASIC");
        basic.setBasic(true);
        when(profileEntryDictRepository.findByCode("BASIC")).thenReturn(Optional.of(basic));

        assertThrows(
                KnowledgeException.class,
                () -> resolver.resolveNonBasicProfileEntryCodes(List.of("BASIC")));
    }
}
