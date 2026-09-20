import { test, expect } from '@playwright/test';
import {
  parseBuyerListQuery,
  serializeBuyerListQuery,
  applyBuyerListUrlUpdates,
} from '../src/features/admin-buyers/lib/buyer-list-state';

test.describe('Admin Buyers CRM Query State & Serialization', () => {
  test('parseBuyerListQuery sets defaults correctly for empty search params', () => {
    const params = new URLSearchParams('');
    const state = parseBuyerListQuery(params);
    expect(state.search).toBe('');
    expect(state.status).toBe('all');
    expect(state.page).toBe(1);
    expect(state.view).toBe('list');
  });

  test('parseBuyerListQuery parses custom search, status, page, and view', () => {
    const params = new URLSearchParams('search=john&status=active&page=3&view=grid');
    const state = parseBuyerListQuery(params);
    expect(state.search).toBe('john');
    expect(state.status).toBe('active');
    expect(state.page).toBe(3);
    expect(state.view).toBe('grid');
  });

  test('parseBuyerListQuery clamps invalid page and status values', () => {
    const params = new URLSearchParams('status=unknown&page=-5&view=card');
    const state = parseBuyerListQuery(params);
    expect(state.status).toBe('all');
    expect(state.page).toBe(1);
    expect(state.view).toBe('list');
  });

  test('serializeBuyerListQuery creates clean search params without defaults', () => {
    const params = serializeBuyerListQuery({
      search: '',
      status: 'all',
      page: 1,
      view: 'list',
    });
    expect(Object.keys(params).length).toBe(0);
  });

  test('serializeBuyerListQuery preserves non-default values', () => {
    const params = serializeBuyerListQuery({
      search: 'alice@example.com',
      status: 'inactive',
      page: 4,
      view: 'grid',
    });
    expect(params['search']).toBe('alice@example.com');
    expect(params['status']).toBe('inactive');
    expect(params['page']).toBe('4');
    expect(params['view']).toBe('grid');
  });

  test('applyBuyerListUrlUpdates resets page when searching and preserves existing params', () => {
    const initial = new URLSearchParams('search=bob&page=2&view=grid');
    const updated = applyBuyerListUrlUpdates(initial, { search: 'charlie', page: '' });
    expect(updated.get('search')).toBe('charlie');
    expect(updated.has('page')).toBe(false);
    expect(updated.get('view')).toBe('grid');
  });
});
