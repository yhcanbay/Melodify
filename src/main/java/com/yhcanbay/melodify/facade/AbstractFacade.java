package com.yhcanbay.melodify.facade;

import jakarta.ejb.Stateless;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@Stateless
public class AbstractFacade {
    @PersistenceContext(unitName = "default")
    private EntityManager em;
}
