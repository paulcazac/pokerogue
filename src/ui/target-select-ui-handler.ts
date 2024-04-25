import { BattlerIndex } from "../battle";
import BattleScene, { Button } from "../battle-scene";
import { Moves } from "../data/enums/moves";
import { Mode } from "./ui";
import UiHandler from "./ui-handler";
import * as Utils from "../utils";
import { getMoveTargets } from "../data/move";
import FightUiHandler from "./fight-ui-handler";
import { addTextObject, TextStyle } from "./text";
import { CommandPhase } from "#app/phases.js";
import Pokemon, { EnemyPokemon } from "#app/field/pokemon.js";
import { Type } from "#app/data/type.js";
import { MoveCategory } from "#app/data/move.js";

export type TargetSelectCallback = (cursor: integer) => void;

export default class TargetSelectUiHandler extends UiHandler {
  private move: Moves;
  private targetSelectCallback: TargetSelectCallback;
  private fightUiHandler: FightUiHandler;
  private movesContainer: Phaser.GameObjects.Container;
  private typeIcon: Phaser.GameObjects.Sprite;
  private ppText: Phaser.GameObjects.Text;
  private cursorObj: Phaser.GameObjects.Image;
  private moveCategoryIcon: Phaser.GameObjects.Sprite;

  protected fieldIndex: integer = 0;
  protected cursor2: integer = 0;

  private targets: BattlerIndex[];
  private targetFlashTween: Phaser.Tweens.Tween;

  constructor(scene: BattleScene) {
    super(scene, Mode.TARGET_SELECT);
    this.cursor = -1;
  }

  setup(): void {
    console.log("SETUP")

    const ui = this.getUi();
    
    this.movesContainer = this.scene.add.container(18, -38.7);
    ui.add(this.movesContainer);

    this.typeIcon = this.scene.add.sprite((this.scene.game.canvas.width / 6) - 41, -31, 'types', 'unknown');
    this.typeIcon.setVisible(false);
    ui.add(this.typeIcon);

    this.moveCategoryIcon = this.scene.add.sprite((this.scene.game.canvas.width / 6) - 19, -31, 'categories', 'physical');
    this.moveCategoryIcon.setVisible(false);
    ui.add(this.moveCategoryIcon);
  

    this.ppText = addTextObject(this.scene, (this.scene.game.canvas.width / 6) - 18, -15.5, '    /    ', TextStyle.WINDOW);
    this.ppText.setOrigin(1, 0.5);
    this.ppText.setVisible(false);
    ui.add(this.ppText);

    if (!this.cursorObj) {
      this.cursorObj = this.scene.add.image(0, 0, 'cursor');
      this.cursorObj.setVisible(false)
      ui.add(this.cursorObj);
    }
   }

  show(args: any[]): boolean {
    console.log("SHOW")
    if (args.length < 3)
      return false;

    super.show(args);

    this.fieldIndex = args[0] as integer;
    this.move = args[1] as Moves;
    this.targetSelectCallback = args[2] as TargetSelectCallback;
    this.targets = getMoveTargets(this.scene.getPlayerField()[this.fieldIndex], this.move).targets;

    const messageHandler = this.getUi().getMessageHandler();
    messageHandler.movesWindowContainer.setVisible(true);  // type pp
    this.typeIcon.setVisible(true);
    this.ppText.setVisible(true);

    if (!this.targets.length)
      return false;

    this.setCursor(this.targets.indexOf(this.cursor) > -1 ? this.cursor : this.targets[0]);
    const target = this.scene.getField()[this.cursor]
    const enemies= this.scene.getEnemyParty();
    
    this.showTargetEffectiveness(target,enemies);

    return true;
  }

  showTargetEffectiveness(target:Pokemon,enemies:EnemyPokemon[]){
    // add logic depending on enemy or partner
    if (enemies[0].name===target.name){
      this.clearMoves()
      this.scene.selectedTarget = enemies[0]
      this.displayMoves(enemies[0]);
    }
    else {
      this.clearMoves()
      this.scene.selectedTarget = enemies[1]
      this.displayMoves(enemies[1]);}

  }

  processInput(button: Button): boolean {
    const ui = this.getUi();

    let success = false;

    if (button === Button.ACTION || button === Button.CANCEL) {
      this.targetSelectCallback(button === Button.ACTION ? this.cursor : -1);
      success = true;
    } else {
      switch (button) {
        case Button.UP:
          if (this.cursor < BattlerIndex.ENEMY && this.targets.findIndex(t => t >= BattlerIndex.ENEMY) > -1)
            success = this.setCursor(this.targets.find(t => t >= BattlerIndex.ENEMY));
          break;
        case Button.DOWN:
          if (this.cursor >= BattlerIndex.ENEMY && this.targets.findIndex(t => t < BattlerIndex.ENEMY) > -1)
            success = this.setCursor(this.targets.find(t => t < BattlerIndex.ENEMY));
          break;
        case Button.LEFT:
          if (this.cursor % 2 && this.targets.findIndex(t => t === this.cursor - 1) > -1)
            success = this.setCursor(this.cursor - 1);
          break;
        case Button.RIGHT:
          if (!(this.cursor % 2) && this.targets.findIndex(t => t === this.cursor + 1) > -1)
            success = this.setCursor(this.cursor + 1);
          break;
      }
    }

    if (success)
      ui.playSelect();

    return success;
  }

  setCursor(cursor: integer): boolean {
    const lastCursor = this.cursor;

    const ret = super.setCursor(cursor);

    if (this.targetFlashTween) {
      this.targetFlashTween.stop();
      const lastTarget = this.scene.getField()[lastCursor];
      if (lastTarget)
        lastTarget.setAlpha(1);
    }

    const target = this.scene.getField()[cursor];
    const enemies= this.scene.getEnemyParty();
    //change to cases
    this.showTargetEffectiveness(target,enemies);
    

    this.targetFlashTween = this.scene.tweens.add({
      targets: [ target ],
      alpha: 0,
      loop: -1,
      duration: Utils.fixedInt(250),
      ease: 'Sine.easeIn',
      yoyo: true,
      onUpdate: t => {
        if (target)
          target.setAlpha(t.getValue());
      }
    });

    return ret;
  }

  eraseCursor() {
    const target = this.scene.getField()[this.cursor];
    if (this.targetFlashTween) {
      this.targetFlashTween.stop();
      this.targetFlashTween = null;
    }
    if (target)
      target.setAlpha(1);
    
  }

  clear() {
    super.clear();
    this.eraseCursor();
    this.clearMoves();
    this.typeIcon.setVisible(false);
    this.ppText.setVisible(false);
    this.moveCategoryIcon.setVisible(false);
    this.cursorObj.setVisible(false);
  }
  

  displayMoves(pokemon?: EnemyPokemon) {
    const opponentPokemon = pokemon || this.scene.getEnemyPokemon();

    const moveset = (this.scene.getCurrentPhase() as CommandPhase).getPokemon().getMoveset();
  
    for (let m = 0; m < 4; m++) {
      const moveText = addTextObject(this.scene, m % 2 === 0 ? 0 : 100, m < 2 ? 0 : 16, '-', TextStyle.WINDOW);
      
      const pokemonMove = moveset[m];
      if (pokemonMove.moveId===this.move) {
        
        this.typeIcon.setTexture('types', Type[pokemonMove.getMove().type].toLowerCase()).setScale(0.65);
        this.moveCategoryIcon.setTexture('categories', MoveCategory[pokemonMove.getMove().category].toLowerCase()).setScale(0.8);
  
        const maxPP = pokemonMove.getMovePp();
        const pp = maxPP - pokemonMove.ppUsed;
        
  
        this.ppText.setText(`${Utils.padInt(pp, 2, '  ')}/${Utils.padInt(maxPP, 2, '  ')}`);
        this.cursorObj.setPosition(13 + (m % 2 === 1 ? 100 : 0), -31 + (m >= 2 ? 15 : 0));

      }
  
      this.typeIcon.setVisible(true);
      this.ppText.setVisible(true);
      this.moveCategoryIcon.setVisible(true);
      this.cursorObj.setVisible(true);

      if (m < moveset.length){
        const pokemonMove = moveset[m];
        moveText.setText(moveset[m].getName());
        const effectiveness = (opponentPokemon.getAttackMoveEffectiveness(opponentPokemon,pokemonMove))
        
        let color = "white"; // Default to white if setting is off or for normal effectiveness
        if (this.scene.showEffectiveness) {
          if (effectiveness === 0) {
            moveText.setColor(this.getTextColor(TextStyle.ZERO_X_EFFECT)); // No effect
          } else if (effectiveness === 4) {
            moveText.setColor("limegreen"); // x4 Super effective
          } else if (effectiveness === 2) {
            moveText.setColor(this.getTextColor(TextStyle.TWO_X_EFFECT));
          } else if (effectiveness === 0.5) {
            moveText.setColor("red"); // x0.5 Not very effective
          } else if (effectiveness === 0.25) {
            moveText.setColor("darkred"); // x0.25 Not very effective
          }
        }
        
      }
      this.movesContainer.add(moveText);
      
    }
  }
 

  clearMoves() {
    this.movesContainer.removeAll(true);
  }

  fixedMoveEffectiveness(){
    
  }

  
}

