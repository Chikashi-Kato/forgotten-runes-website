import { keyBy } from "lodash";
import { IMAGE_NOBG_BASE_URL } from "../../../../constants";
import { getWizardsContract } from "../../../../contracts/ForgottenRunesWizardsCultContract";
import { linearmap } from "../../../gameUtils";
import { BurningWizardSprite } from "../../../objects/BurningWizardSprite";
import { ImageButton } from "../../../objects/ImageButton";
import { MetamaskSoul } from "../../../objects/MetamaskSoul";
import { Toast } from "../../../objects/Toast";
import { WizardPicker } from "../../../objects/WizardPicker";
import { ShowScene } from "../show/ShowScene";
import { BurnModal } from "./BurnModal";
import { BurnWarningModal } from "./BurnWarningModal";
import { SoulModal } from "./SoulModal";

const BREAKPOINT = 768;

export class PyreScene extends Phaser.Scene {
  parentScene: Phaser.Scene;

  initialWidth: number = 0;

  numRemaining: number = 9999;
  summonText: any;

  sprites: any;

  // wizardPicker: WizardPicker;
  showScene: any;

  burnModal: BurnModal | undefined;

  metamaskSoul: MetamaskSoul | undefined;

  burnAgain: any;

  container: any;

  pendingText: any;

  initialScrollY: any;

  constructor(parentScene: Phaser.Scene) {
    super("PyreScene");
    this.parentScene = parentScene;
  }

  static preloadStatic(scene: Phaser.Scene) {}

  preload() {
    this.load.path = "/static/game/wizards/";

    this.load.aseprite(
      "SoulsInterior",
      "souls/SoulsInterior3.png",
      "souls/SoulsInterior3.json"
    );
    this.load.aseprite(
      "MMFoxSoul",
      "souls/MMFoxSoul.png",
      "souls/MMFoxSoul.json"
    );
    this.load.atlas(
      "soulsUI",
      "souls/ui/souls-ui.png",
      "souls/ui/souls-ui.json"
    );

    this.load.audio("burn_loop", "souls/audio/burn_loop.mp3");
    this.load.audio("angelic_chord", "souls/audio/angelic_chord.mp3");
    this.load.audio("explosion", "souls/audio/explosion.mp3");

    for (let i = 0; i < 4; i++) {
      this.load.audio(`click0${i}`, `souls/audio/click/click_0${i}.mp3`);
      this.load.audio(
        `hover0${i}`,
        `souls/audio/mouse_over_loops/mouse_over_0${i}.mp3`
      );
    }

    const webfont = {
      custom: {
        families: ["Pixel-NES", "Alagard"],
        urls: ["/static/game/wizards/fonts.css"],
      },
    };
    (this.load as any).rexWebFont(webfont);

    // WizardPicker.preloadStatic(this);
    ShowScene.preloadStatic(this);
  }

  create() {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const centerY = height / 2;
    const worldView = this.cameras.main.worldView;
    const centerX = worldView.centerX;

    const music = this.sound.add("burn_loop");
    music.play({ loop: true });

    this.scale.on("resize", this.resize, this);
    this.initialWidth = width; // store for responsive
    this.updateCamera();

    const zoneGraphics = this.add.graphics();
    zoneGraphics.fillStyle(0x000000, 1);
    zoneGraphics.fillRect(
      centerX - width * 5,
      centerY - height * 5,
      width * 10,
      height * 10
    );

    (this as any).myAasepriteLoader?.createFromAsepriteWithLayers(
      "SoulsInterior"
    );

    const floor = this.add.sprite(centerX, centerY, "SoulsInterior", "BG-0");

    const layers = [
      "BG",
      "eyes",
      "columns_red",
      "circuits",
      "Fire_Large",
      "ray",
      "pyre",
      "circuits_pyre",
      "bottomTile",
      "Glow_01",
      "room_hiLit",
      "candleFlames",
      "glow_candle",
      "fireSmall_2",
      "wood_01",
      "fireSmall_1",
      "wood_02",
      "Glow_02",
      "flameBurst",
      "ExplodeBits",
      "Glow_03",
      "vignette",
    ];

    const soulsLayersByName = keyBy(
      this.game.cache.json.get("SoulsInterior").meta.layers,
      "name"
    );

    this.sprites = layers.reduce((acc: any, name: string) => {
      const sprite = this.add.sprite(
        centerX,
        centerY,
        "SoulsInterior",
        `${name}-0`
      );
      // sprite.setOrigin(0.5, 0);
      acc[name] = sprite;

      const layerMeta = soulsLayersByName[name];
      if (layerMeta?.opacity !== 255) {
        const alphaValue = linearmap(layerMeta.opacity, 0, 255, 0, 1);
        // console.log("alpha", name, alphaValue);
        // for some reason our value needs scaled up a bit
        sprite.setAlpha(alphaValue * 1.7);
      }
      if (layerMeta?.blendMode === "lighten") {
        sprite.blendMode = Phaser.BlendModes.LIGHTEN;
      }

      return acc;
    }, {});

    this.sprites["eyes"].setAlpha(0);

    this.sprites["circuitsTop"] = this.add.sprite(
      centerX,
      centerY,
      "SoulsInterior",
      `circuits-0`
    );
    this.sprites["circuitsTop"].setAlpha(0);
    this.sprites["circuitsTop"].blendMode = Phaser.BlendModes.LIGHTEN;

    this.startIdle();
    this.scrollToTop();

    this.addControls();

    (this.cameras.main as any).preRender(1);
    this.updateCamera();

    this.addMetamaskButton();

    this.burnModal = new BurnModal({ scene: this });
    this.burnModal.onBurnInitiated = ({ hash, wizardId }) => {
      console.log("hash, wizardId: ", hash, wizardId);
      this.burnModal?.hide();
      this.metamaskSoul?.hide();

      this.time.addEvent({
        delay: 1500,
        callback: () => {
          this.showConfirmingSoul({ wizardId: wizardId });
          this.addEtherscanPendingMessage({ hash });
        },
      });
    };

    this.burnModal.onBurnConfirmed = ({ hash, wizardId }) => {
      console.log("hash, wizardId: ", hash, wizardId);
      this.playExplosion();
      this.hideEtherscanPendingMessage();

      this.time.addEvent({
        delay: 2500,
        callback: () => {
          this.setConfirmedBurn({ wizardId });
        },
      });

      // ---------------
      // TODO right here
      // --------------
      // hide your burning wizard
      // now show the soul
    };
    this.burnModal.onBurnError = ({ hash, wizardId, err }) => {
      console.log("hash, wizardId: ", hash, wizardId, err);
      const toast = new Toast();
      toast.create({
        scene: this,
        message: err?.message?.substr(0, 200) || "There was a problem",
        duration: 3000,
        color: "#ffffff",
      });
    };

    this.addExitScene();

    (this.cameras.main as any).preRender(1);
    this.updateCamera();

    // const warningModal = new BurnWarningModal({ scene: this, wizardId: 72 });
    // warningModal.show({ wizardId: 72 });
    // warningModal.onComplete = () => {
    //   console.log("on complete");
    //   warningModal.hide();
    // };

    // TMP
    // this.burnModal.show({ wizardId: 78 });
    // this.wizardPicker = new WizardPicker();
    // this.wizardPicker.create({ scene: this });
    this.updateCamera();

    // // TMP
    // / this.wizardPicker.open();
    // this.openWizardPicker();

    // setTimeout(() => {
    //   const toast = new Toast();
    //   toast.create({
    //     scene: this,
    //     message: "Testing toast",
    //     duration: 3000,
    //     color: "#ffffff",
    //   });
    // }, 100);

    // const testButton = new ImageButton(
    //   this,
    //   centerX - 400,
    //   centerY + 200,
    //   "soulsUI",
    //   "yes_default.png",
    //   "yes_hover.png",
    //   ({ btn }: { btn: ImageButton }) => {
    //     console.log("yes");
    //     this.metamaskSoul?.hide();
    //     this.showConfirmingSoul({ wizardId: 44 });
    //   }
    // );
    // testButton.setScale(0.5);
    // this.add.existing(testButton);

    // const testButton2 = new ImageButton(
    //   this,
    //   centerX - 400,
    //   centerY + 240,
    //   "soulsUI",
    //   "no_default.png",
    //   "no_hover.png",
    //   ({ btn }: { btn: ImageButton }) => {
    //     console.log("no");
    //     this.playExplosion();
    //     this.hideEtherscanPendingMessage();

    //     this.time.addEvent({
    //       delay: 1500,
    //       callback: () => {
    //         this.setConfirmedBurn();
    //       },
    //     });
    //   }
    // );
    // testButton2.setScale(0.5);
    // this.add.existing(testButton2);

    // this.showConfirmingSoul({ wizardId: 44 });
    // this.addEtherscanPendingMessage({ hash: "abc123" });

    // this.setConfirmedBurn();
  }

  addExitScene() {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const centerY = height / 2;
    const worldView = this.cameras.main.worldView;
    const centerX = worldView.centerX;

    const exitButton = new ImageButton(
      this,
      centerX,
      centerY + 400,
      "soulsUI",
      "exit1.png",
      "exit1.png",
      ({ btn }: { btn: ImageButton }) => {
        console.log("exit");
        this.dismissScene();
      }
    );
    exitButton.setOrigin(0.5, 0);
    exitButton.setScale(0.5);
    this.add.existing(exitButton);
  }

  addMetamaskButton() {
    // if (!this.metamaskSoul) {
    this.metamaskSoul = new MetamaskSoul({
      onConnect: () => {
        console.log("metamaskSoul onConnect");
        this.openWizardPicker();
      },
    });
    // }
    this.metamaskSoul.createIfNeeded({ scene: this });
  }

  addBurnAgainButton() {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const centerY = height / 2;
    const worldView = this.cameras.main.worldView;
    const centerX = worldView.centerX;

    // const testButton = new ImageButton(
    //   this,
    //   centerX,
    //   centerY,
    //   "soulsUI",
    //   "yes_default.png",
    //   "yes_hover.png",
    //   ({ btn }: { btn: ImageButton }) => {
    //     this.metamaskSoul?.hide();
    //     this.showConfirmingSoul({ wizardId: 44 });
    //   }
    // );
    // testButton.setScale(0.5);
    // this.add.existing(testButton);
  }

  setConfirmedBurn({ wizardId }: { wizardId: number }) {
    this.startIdle();

    let burningWizardSprite = this.sprites["burningWizard"];
    if (burningWizardSprite) {
      burningWizardSprite.destroy();
    }

    if (this.sprites["eyes"]) {
      this.sprites["eyes"].stopAfterRepeat();
    }

    const soulModal = new SoulModal({ scene: this });
    soulModal.show({ wizardId });
  }

  getProvider() {
    return (this.parentScene as any).getProvider();
  }

  startIdle() {
    const { ray } = this.sprites;
    ray.setAlpha(0);

    const hides = [
      "Fire_Large",
      "ray",
      // "eyes", // deal w/ this outside
      "room_hiLit",
      "flameBurst",
      "ExplodeBits",
      // "vignette",
    ];
    hides.forEach((hideName) => {
      this.sprites[hideName].setAlpha(0);
    });

    const plays = [
      "Glow_01",
      "candleFlames",
      "fireSmall_2",
      "fireSmall_1",
      "Glow_02",
      "Glow_03",
      // "vignette",
    ];
    plays.forEach((playName) => {
      this.sprites[playName].play({
        key: `${playName}-play`,
        delay: 0,
        repeatDelay: 0,
        repeat: -1,
      });
    });

    this.sprites["circuitsTop"].setAlpha(0);
    const tweens = this.tweens.getTweensOf(this.sprites["circuitsTop"]);
    tweens.forEach((tween) => {
      tween.stop();
      tween.remove();
    });
  }

  playExplosion() {
    const shakeDuration = 750;
    const shakeVector = new Phaser.Math.Vector2(0.0005, 0);
    this.cameras.main.shake(shakeDuration, shakeVector);

    const explosion = this.sound.add("explosion");
    explosion.play({ volume: 5 });

    const playsOnce = ["vignette", "room_hiLit", "flameBurst", "ExplodeBits"];
    playsOnce.forEach((playName) => {
      this.sprites[playName].setAlpha(1);
      this.sprites[playName].play({
        key: `${playName}-play`,
        delay: 0,
        repeatDelay: 0,
        repeat: 0,
      });
    });

    // add ray
    this.tweens.add({
      targets: this.sprites["ray"],
      alpha: { value: 0.6, duration: 500, ease: "Power1" },
    });
  }

  showConfirmingSoul({ wizardId }: { wizardId: number }) {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const centerY = height / 2;
    const worldView = this.cameras.main.worldView;
    const centerX = worldView.centerX;

    this.tweens.add({
      targets: this.sprites["circuitsTop"],
      alpha: { value: 0.7, duration: 1400, ease: "Linear" },
      delay: 0,
      yoyo: true,
      repeat: -1,
    });

    this.tweens.add({
      targets: this.sprites["eyes"],
      alpha: { value: 1, duration: 500, ease: "Power1" },
    });

    this.sprites["eyes"].play({
      key: `eyes-play`,
      delay: 0,
      repeatDelay: 0,
      repeat: -1,
      yoyo: true,
    });

    const playsLoop = ["Fire_Large"];
    playsLoop.forEach((playName) => {
      this.sprites[playName].setAlpha(1);
      this.sprites[playName].play({
        key: `${playName}-play`,
        delay: 0,
        repeatDelay: 0,
        repeat: -1,
      });
    });

    BurningWizardSprite.fromWizardId({
      scene: this,
      wizardId,
      cb: ({ sprite }: { sprite: BurningWizardSprite }) => {
        this.sprites["burningWizard"] = sprite;
        this.add.existing(sprite);
        sprite.setScale(0.33);
        sprite.setOrigin(0.5, 0.5);
        sprite.setPosition(centerX, centerY - 120);
        sprite.playBurn();

        this.tweens.add({
          targets: sprite,
          alpha: { value: 0.2, duration: 1400, ease: "Power1" },
          delay: 0,
          yoyo: true,
          repeat: -1,
        });
      },
    });
  }

  update() {
    // if (this.summonText) {
    //   this.summonText.setText(`${this.numRemaining}`);
    // }
  }

  scrollToTop() {
    const height = this.scale.gameSize.height;
    // set initial camera scroll
    const bgHeight = this.sprites["BG"].height;
    // console.log(
    //   "bgHeight: ",
    //   height,
    //   bgHeight,
    //   height - bgHeight,
    //   (height - bgHeight) / 2,
    //   this.cameras.main.zoom,
    //   (height - bgHeight) / 2 / this.cameras.main.zoom,
    //   -bgHeight / 2 / this.cameras.main.zoom
    // );
    this.cameras.main.scrollY =
      ((height - bgHeight) / 2) * this.cameras.main.zoom;
    // console.log("this.cameras.main.scrollY: ", this.cameras.main.scrollY);
  }

  updateCamera() {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const centerX = width / 2;
    const centerY = height / 2;
    // const camera = this.cameras.main;
    const desktop = this.scale.gameSize.width >= BREAKPOINT;
    const mobile = !desktop;

    if (this.cameras.main) {
      const centerX = this.cameras.main.width / 2;

      const initialCenterX = this.initialWidth / 2;
      this.cameras.main.scrollX = (centerX - initialCenterX) * -1;

      if (width < BREAKPOINT) {
        this.cameras.main.scrollY = 60;
        this.cameras.main.setZoom(1);
      } else {
        // this.cameras.main.scrollY = 0;
        // this.cameras.main.setZoom(1.5);
        this.cameras.main.scrollY = 60;
        this.cameras.main.setZoom(1.5);
      }
    }
  }
  resize(gameSize: any, baseSize: any, displaySize: any, resolution: any) {
    console.log("resize", gameSize, baseSize, displaySize, resolution);
    // this.resize(gameSize, baseSize, displaySize, resolution);
    this.updateCamera();

    if (this.showScene) {
      this.showScene.resize(gameSize, baseSize, displaySize, resolution);
    }
  }
  dismissScene() {
    this.parentScene.scene.stop("PyreScene");
  }

  openWizardPicker() {
    const self = this;
    this.metamaskSoul?.hide();

    const onWizardPicked = ({ nftId }: { nftId: any }) => {
      console.log("wizard: ", nftId);
      self.scene.stop("ShowScene");
      self.burnModal?.show({ wizardId: nftId });
    };

    // TMP
    // setTimeout(() => {
    //   onWizardPicked({ nftId: 0 });
    // }, 2000);

    const showSceneOpts = {
      onWizardPicked,
      showSocials: false,
      addSelectButton: ({
        scene,
        container,
        nftId,
      }: {
        scene: Phaser.Scene;
        container: any;
        nftId: any;
      }) => {
        const summonButton = scene.add.sprite(
          0,
          110,
          "soulsUI",
          "pick_default.png"
        );
        summonButton.setOrigin(0.5, 0);
        summonButton.setScale(1);
        summonButton
          .setInteractive({ useHandCursor: true })
          .on("pointerover", () => {
            summonButton.setFrame("pick_hover.png");
          })
          .on("pointerout", () => {
            summonButton.setFrame("pick_default.png");
          })
          .on("pointerdown", () => {
            summonButton.setAlpha(0.6);
          })
          .on("pointerup", () => {
            summonButton.setAlpha(1);
            onWizardPicked({ nftId });
          });

        container.add(summonButton);
      },
      onCloseButtonPushed: () => {
        this.addMetamaskButton();
      },
    };

    if (this.showScene) {
      this.scene.launch("ShowScene", showSceneOpts);
      this.showScene.scene.bringToTop();
    } else {
      this.scene.launch("ShowScene", showSceneOpts);
      this.showScene = this.scene.get("ShowScene");
      this.showScene.scene.bringToTop();
      this.showScene.parentScene = this;
    }
  }

  addEtherscanPendingMessage({ hash }: { hash: string }) {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const centerY = height / 2;
    const worldView = this.cameras.main.worldView;
    const centerX = worldView.centerX;
    const zoom = this.cameras?.main?.zoom || 1;

    this.pendingText = this.make.text({
      x: 0,
      y: 0,
      text: "Pending. View on Etherscan...",
      style: {
        fontFamily: "Alagard",
        fontSize: Math.floor(16 * zoom) + "px",
        color: "#E1DECD",
        wordWrap: { width: 220 * zoom },
        align: "center",
        metrics: {
          fontSize: 20 * zoom,
          ascent: 15 * zoom,
          descent: 2 * zoom,
        },
      },
    });
    this.pendingText.setScale(1 / zoom);
    this.pendingText.setOrigin(0.5, 0.5);
    this.pendingText.setPosition(centerX, centerY + 270);
    this.add.existing(this.pendingText);

    this.pendingText
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        this.pendingText.setAlpha(0.8);
      })
      .on("pointerout", () => {
        this.pendingText.setAlpha(1);
      })
      .on("pointerdown", () => {
        this.pendingText.setAlpha(0.6);
      })
      .on("pointerup", () => {
        this.pendingText.setAlpha(1);
        const etherscanURL = `${process.env.NEXT_PUBLIC_REACT_APP_BLOCK_EXPLORER}/tx/${hash}`;
        window.open(etherscanURL, "_blank");
      });

    this.tweens.add({
      targets: this.pendingText,
      alpha: { value: 0.2, duration: 1400, ease: "Linear" },
      delay: 0,
      yoyo: true,
      repeat: -1,
    });
  }

  hideEtherscanPendingMessage() {
    if (this.pendingText) {
      this.pendingText.destroy();
      this.pendingText = null;
    }
  }

  addControls() {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const centerY = height / 2;
    const worldView = this.cameras.main.worldView;
    const centerX = worldView.centerX;
    const camera = this.cameras.main;
    this.initialScrollY = camera.scrollY;
    const maxScroll = 300;

    this.input.on(
      "wheel",
      (
        pointer: any,
        gameObjects: any,
        deltaX: number,
        deltaY: number,
        deltaZ: number
      ) => {
        const camera = this.cameras.main;
        camera.scrollY += deltaY * 0.5 * 1;
        camera.scrollY = Math.max(-50, camera.scrollY);
        camera.scrollY = Math.min(camera.scrollY, maxScroll);
        // console.log(" camera.scrollY: ", camera.scrollY);
      }
    );

    const rayZone = this.add.zone((width / 2) * -1, 0, width * 3, height * 100);
    rayZone.setOrigin(0, 0);
    rayZone
      .setInteractive({ draggable: true, useHandCursor: false })
      .on("pointerup", () => {
        // console.log("drag zone up", this.parentScene);
      })
      .on("drag", (pointer: any, dragX: number, dragY: number) => {
        // console.log("drag zone drag", this.parentScene);
        const camera = this.cameras.main;
        camera.scrollY += dragY * 0.5 * -1;
        camera.scrollY = Math.max(-50, camera.scrollY);
        camera.scrollY = Math.min(camera.scrollY, maxScroll);
      });
  }
}
