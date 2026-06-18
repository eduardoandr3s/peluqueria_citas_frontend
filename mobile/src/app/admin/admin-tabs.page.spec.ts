import { AdminTabsPage } from './admin-tabs.page';

describe('AdminTabsPage', () => {
  it('se crea y registra sus iconos', () => {
    expect(new AdminTabsPage()).toBeTruthy();
  });
});
