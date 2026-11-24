// Steps shared by several scenarios. This file sits in a subfolder so the harness, which
// runs every .mjs directly inside playtest/, does not treat it as a scenario.

/** The title screen comes first: get past it to the main menu. */
export const TO_MENU = `(() => {
  if (game.scene.isActive('TitleScene')) game.scene.getScene('TitleScene').start();
  return game.scene.isActive('MainMenuScene');
})()`;

export const reachMenu = {
  name: 'reaches the main menu (past the title screen)',
  action: 'waitFor',
  expression: TO_MENU,
  timeout: 10000,
};
