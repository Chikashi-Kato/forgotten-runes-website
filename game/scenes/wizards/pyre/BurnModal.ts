import { values } from "lodash";
import { IMAGE_NOBG_BASE_URL } from "../../../../constants";
import {
  FORGOTTEN_SOULS_ADDRESS,
  getInfinityVeilContract,
  getSoulsContract,
  getWizardsContract,
  INFINITY_VEIL_ADDRESS,
  WIZARDS_CONTRACT_ADDRESS,
} from "../../../../contracts/ForgottenRunesWizardsCultContract";
import { Toast } from "../../../objects/Toast";
import { fetchSoulsMetadataWithRetry } from "../../../portal";
import { getWeb3Controller } from "../home/Web3Controller";
import { BurnWarningModal } from "./BurnWarningModal";
import { ProgressBullet } from "./ProgressBullet";

const SECONDS = 1000;

export type OnBurnInitiatedFn = ({
  hash,
  wizardId,
}: {
  hash: string;
  wizardId: number;
}) => void;

export type OnBurnConfirmedFn = ({
  hash,
  wizardId,
  receipt,
}: {
  hash: string;
  wizardId: number;
  receipt: any;
}) => void;

export type OnBurnErrorFn = ({
  hash,
  wizardId,
  err,
}: {
  hash: string;
  wizardId: number;
  err?: any;
}) => void;

export class BurnModal {
  sprite: any;
  scene: Phaser.Scene | undefined;

  onConnect: any;

  frame: any;

  container: any;

  instructionText: any;

  bullets: any;

  wizardId: any;

  onBurnInitiated: OnBurnInitiatedFn = () => null;
  onBurnConfirmed: OnBurnConfirmedFn = () => null;
  onBurnError: OnBurnErrorFn = () => null;
  constructor({ scene }: { scene: Phaser.Scene }) {
    this.scene = scene;
  }

  show({ wizardId }: { wizardId: number }) {
    const scene = this.scene;
    if (!scene) return;
    const worldView: Phaser.Geom.Rectangle = scene.cameras.main.worldView;
    const bottomY = worldView.height;
    const centerY = worldView.height / 2;
    const rightX = worldView.width;
    const centerX = worldView.centerX;

    this.addFrame();
    this.addCloseButton();
    this.addInstructionText();
    this.addWizardImage({ wizardId });
    this.wizardId = wizardId;

    this.writeMessage({
      msg: "To burn your Wizard, complete the spells below",
    });

    this.addStepsBullets();
    this.addHelp();

    return this;
  }

  hide() {
    if (this.container) {
      this.scene?.tweens.add({
        targets: [this.container, ...values(this.bullets)],
        alpha: { value: 0, duration: 500, ease: "Power1" },
        delay: 0,
      });

      values(this.bullets).map((bullet) => {
        if (bullet) {
          bullet.hide();
        }
      });

      this.scene?.time.addEvent({
        delay: 500 + 10,
        callback: () => {
          this.container.destroy();
        },
      });
    }
  }

  async sendTx({
    buildTx,
    onPending,
    onConfirm,
    onError,
  }: {
    buildTx: any;
    onConfirm: any;
    onPending: any;
    onError: any;
  }) {
    if (!this.scene) return;
    const web3Controller = getWeb3Controller(this.scene.game);
    const injectedProvider = web3Controller.injectedProvider;
    if (!injectedProvider) {
      console.log("ERROR: Couldn't find Metamask. Go back and connect.");
      const toast = new Toast();
      toast.create({
        scene: this.scene,
        message: "Can't find Metamask",
        duration: 3000,
        color: "#ffffff",
      });
      return;
    }
    const { chainId } = await injectedProvider.getNetwork();
    const signer = injectedProvider.getSigner();

    const tx = await buildTx({ signer, injectedProvider, chainId });

    console.log("signer: ", signer);
    console.log("tx: ", tx);
    let txHash;
    try {
      const txResponse = await signer.sendTransaction(tx);
      txHash = txResponse.hash;
      console.log("txResponse: ", txResponse);
      onPending({ hash: txHash });

      const receipt = await injectedProvider.waitForTransaction(
        txHash,
        2, // confirmations
        60 * 1000 * 10
      );
      onConfirm({ hash: txHash, receipt });
    } catch (err) {
      onError({ hash: txHash });
      console.log("err toast: ", err);
      const toast = new Toast();
      toast.create({
        scene: this.scene,
        message:
          (err as Error)?.message?.substr(0, 200) ||
          "Sorry, there was a problem",
        duration: 3000,
        color: "#ffffff",
      });
    }
  }

  addStepsBullets() {
    const scene = this.scene;
    if (!scene) return;
    const width = scene.scale.gameSize.width;
    const height = scene.scale.gameSize.height;
    const centerY = height / 2;
    const worldView = scene.cameras.main.worldView;
    const centerX = worldView.centerX;

    const rowBase = -104;
    const rowHeight = 35;
    const xBase = -80;

    const approveFlamesContainer = scene.add.container(
      centerX + xBase,
      centerY + rowBase + rowHeight * 1
    );
    const approveWizardsContainer = scene.add.container(
      centerX + xBase,
      centerY + rowBase + rowHeight * 2
    );
    const burnBothContainer = scene.add.container(
      centerX + xBase,
      centerY + rowBase + rowHeight * 3
    );

    //
    let flamesApproved = false;
    let wizardsApproved = false;

    const approveFlames = new ProgressBullet({
      scene,
      container: approveFlamesContainer,
      msg: "Approve your flame",
      enabled: true,
    });

    const approveWizards = new ProgressBullet({
      scene,
      container: approveWizardsContainer,
      msg: "Approve your wizard",
      enabled: true,
    });

    const burnBoth = new ProgressBullet({
      scene,
      container: burnBothContainer,
      msg: "Burn them both",
      enabled: false,
    });

    const onClickBurnBoth = (parent: ProgressBullet) => {
      console.log("burn both clicked");
      if (!this.scene) return;
      if (!flamesApproved) {
        const toast = new Toast();
        toast.create({
          scene,
          message: "Please approve Flames before trying to burn",
          duration: 3000,
          color: "#ffffff",
        });
      }
      if (!wizardsApproved) {
        const toast = new Toast();
        toast.create({
          scene,
          message: "Please approve Wizards before trying to burn",
          duration: 3000,
          color: "#ffffff",
        });
      }

      const warningModal = new BurnWarningModal({
        scene: this.scene,
        wizardId: this.wizardId,
      });
      warningModal.show({ wizardId: this.wizardId });

      warningModal.onComplete = () => {
        console.log("Burning. May the gods have mercy on your Soul");
        this.sendTx({
          buildTx: async ({ injectedProvider, chainId }: any) => {
            const contract = await getSoulsContract({
              provider: injectedProvider,
            });
            const tx = await contract.populateTransaction.mint(
              WIZARDS_CONTRACT_ADDRESS[chainId],
              this.wizardId
            );
            return tx;
          },
          onPending: ({ hash }: { hash: string }) => {
            warningModal.hide();
            parent.onPendingTx({ hash });
            this.onBurnInitiated({ hash, wizardId: this.wizardId });
          },
          onConfirm: ({ hash, receipt }: { hash: string; receipt: any }) => {
            const toast = new Toast();
            toast.create({
              scene,
              message: "Burning Complete",
              duration: 3000,
              color: "#ffffff",
            });
            parent.onPendingTxConfirmed();

            // right here...
            // check our API server for the title and image
            const soulData = fetchSoulsMetadataWithRetry({
              soulId: this.wizardId,
            })
              .then(() => {
                this.onBurnConfirmed({
                  hash,
                  wizardId: this.wizardId,
                  receipt,
                });
              })
              .catch((err) => {
                this.onBurnError({ hash, wizardId: this.wizardId, err });
              });
          },
          onError: ({ hash }: { hash: any }) => {
            warningModal.hide();
            parent.onPendingTxError();
            this.onBurnError({ hash, wizardId: this.wizardId });
          },
        });
      };
    };

    burnBoth.setEnabled(false);
    burnBoth.setOnClick(onClickBurnBoth);

    const checkBothApproved = () => {
      if (flamesApproved && wizardsApproved) {
        burnBoth.setEnabled(true);
      }
    };

    const checkFlamesApprovedAlready = async () => {
      const web3Controller = getWeb3Controller(scene.game);
      const injectedProvider = web3Controller.injectedProvider;
      if (!injectedProvider) return;
      const { chainId } = await injectedProvider.getNetwork();
      const signer = injectedProvider.getSigner();
      const contract = await getInfinityVeilContract({
        provider: injectedProvider,
      });
      const isApproved = await contract.isApprovedForAll(
        await signer.getAddress(),
        FORGOTTEN_SOULS_ADDRESS[chainId]
      );
      console.log("isApproved: ", isApproved);
      if (isApproved) {
        flamesApproved = true;
        checkBothApproved();
        approveFlames.setCurrentStatus({ newStatus: "COMPLETE" });
      }
    };

    const checkWizardsApprovedAlready = async () => {
      const web3Controller = getWeb3Controller(scene.game);
      const injectedProvider = web3Controller.injectedProvider;
      if (!injectedProvider) return;
      const { chainId } = await injectedProvider.getNetwork();
      const signer = injectedProvider.getSigner();
      const contract = await getWizardsContract({
        provider: injectedProvider,
      });
      const isApproved = await contract.isApprovedForAll(
        await signer.getAddress(),
        FORGOTTEN_SOULS_ADDRESS[chainId]
      );
      console.log("isApproved: ", isApproved);
      if (isApproved) {
        wizardsApproved = true;
        checkBothApproved();
        approveWizards.setCurrentStatus({ newStatus: "COMPLETE" });
      }
    };

    const onClickApproveFlames = (parent: ProgressBullet) => {
      console.log("Approving flames");
      this.sendTx({
        buildTx: async ({ injectedProvider, chainId }: any) => {
          const contract = await getInfinityVeilContract({
            provider: injectedProvider,
          });
          const tx = await contract.populateTransaction.setApprovalForAll(
            FORGOTTEN_SOULS_ADDRESS[chainId],
            true
          );
          return tx;
        },
        onPending: ({ hash }: { hash: string }) => {
          parent.onPendingTx({ hash });
        },
        onConfirm: ({ hash, receipt }: { hash: string; receipt: any }) => {
          const toast = new Toast();
          toast.create({
            scene,
            message: "Flames Approved",
            duration: 3000,
            color: "#ffffff",
          });
          parent.onPendingTxConfirmed();
          flamesApproved = true;
          checkBothApproved();
        },
        onError: () => {
          parent.onPendingTxError();
        },
      });
    };
    const onClickApproveWizards = (parent: ProgressBullet) => {
      console.log("Approving Wizards");
      this.sendTx({
        buildTx: async ({ injectedProvider, chainId }: any) => {
          const contract = await getWizardsContract({
            provider: injectedProvider,
          });
          const tx = await contract.populateTransaction.setApprovalForAll(
            FORGOTTEN_SOULS_ADDRESS[chainId],
            true
          );
          return tx;
        },
        onPending: ({ hash }: { hash: string }) => {
          parent.onPendingTx({ hash });
        },
        onConfirm: ({ hash, receipt }: { hash: string; receipt: any }) => {
          const toast = new Toast();
          toast.create({
            scene,
            message: "Wizard Approved",
            duration: 3000,
            color: "#ffffff",
          });
          parent.onPendingTxConfirmed();
          wizardsApproved = true;
          checkBothApproved();
        },
        onError: () => {
          parent.onPendingTxError();
        },
      });
    };
    approveFlames.setOnClick(onClickApproveFlames);
    approveWizards.setOnClick(onClickApproveWizards);
    const delay = 750;

    checkFlamesApprovedAlready();
    checkWizardsApprovedAlready();

    scene.time.addEvent({
      delay: delay * 1,
      callback: () => {
        approveFlames.show();
      },
      startAt: 0,
    });

    scene.time.addEvent({
      delay: delay * 2,
      callback: () => {
        approveWizards.show();
      },
      startAt: 0,
    });

    scene.time.addEvent({
      delay: delay * 3,
      callback: () => {
        burnBoth.show();
      },
      startAt: 0,
    });

    this.bullets = {
      approveFlames,
      approveWizards,
      burnBoth,
    };
  }

  addWizardImage({ wizardId }: { wizardId: number }) {
    const scene = this.scene;
    if (!scene) return;
    const nftImageUrl = `${IMAGE_NOBG_BASE_URL}${wizardId}.png`;
    const wizardImageKey = `wizard:nobg:${wizardId}`;
    scene.load.image(wizardImageKey, nftImageUrl); // add task
    scene.load.once("complete", () => {
      const img = scene.add.sprite(0, -78, wizardImageKey);
      img.setScale(0.25);
      img.setOrigin(0.5, 0);
      this.container.add(img);
    });
    scene.load.start(); // start loading
  }

  addInstructionText() {
    const zoom = this.scene?.cameras?.main?.zoom || 1;

    this.instructionText = this.scene?.make.text({
      x: 0,
      y: 0,
      text: "",
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
    this.instructionText.setScale(1 / zoom);
    this.instructionText.setOrigin(0.5, 0);
    this.instructionText.setPosition(0, -120);
    this.container.add(this.instructionText);
  }

  addFrame() {
    const scene = this.scene;
    if (!scene) return;
    const width = scene.scale.gameSize.width;
    const height = scene.scale.gameSize.height;
    const centerY = height / 2;
    const worldView = scene.cameras.main.worldView;
    const centerX = worldView.centerX;

    this.container = scene.add.container(centerX, centerY - 100);
    this.container.setScale(1);

    const frame = scene.add.sprite(0, 0, "soulsUI", "box.png");
    frame.setScale(0.5);
    frame.setOrigin(0.5, 0.5);
    frame.setInteractive({ useHandCursor: false });
    this.frame = frame;
    this.container.add(frame);

    scene.tweens.add({
      targets: this.container,
      scale: 1,
      ease: "Back.easeOut",
      duration: 100,
      delay: 0,
    });
  }
  addCloseButton() {
    const scene = this.scene;
    if (!scene) return;
    const centerX = Math.floor(scene.cameras.main.width / 2);
    const closeButton = scene.add.sprite(
      centerX + 215,
      80,
      "buttons",
      "button_exit_default.png"
    );

    // closeButton.setOrigin(0, 0);
    // closeButton.setScale(1);
    // closeButton
    //   .setInteractive({ useHandCursor: true })
    //   .on("pointerover", () => {
    //     closeButton.setFrame("button_exit_hover.png");
    //   })
    //   .on("pointerout", () => {
    //     closeButton.setFrame("button_exit_default.png");
    //   })
    //   .on("pointerdown", () => {
    //     closeButton.setAlpha(0.6);
    //   })
    //   .on("pointerup", () => {
    //     closeButton.setAlpha(1);
    //     console.log("clicked");
    //     // this.dismissScene();
    //   });

    // scene.tweens.add({
    //   targets: closeButton,
    //   scale: 1,
    //   ease: "Back.easeOut",
    //   duration: 100,
    // });
  }

  writeMessage({ msg }: { msg: string }) {
    const rexTextTyping = this.scene?.plugins.get("rexTextTyping") as any;
    if (rexTextTyping) {
      const typing = rexTextTyping.add(this.instructionText, {
        speed: 45,
      });
      typing.start(msg);
    }
  }
  addHelp() {
    if (!this.scene) return;
    const zoom = this.scene?.cameras?.main?.zoom || 1;
    const helpText = this.scene.make.text({
      x: 0,
      y: 0,
      text: "help?",
      alpha: 0,
      style: {
        fontFamily: "Alagard",
        fontSize: Math.floor(12 * zoom) + "px",
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
    helpText.setScale(1 / zoom);
    helpText.setOrigin(1, 1);
    helpText.setPosition(112, 130);
    this.container.add(helpText);

    helpText
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        helpText.setAlpha(0.8);
      })
      .on("pointerout", () => {
        helpText.setAlpha(1);
      })
      .on("pointerdown", () => {
        helpText.setAlpha(0.6);
      })
      .on("pointerup", () => {
        helpText.setAlpha(1);
        let location: string = window.location.toString();
        if (location[location.length - 1] !== "/") {
          location += "/";
        }
        window.open(location + "posts/forgotten-souls", "_blank");
      });

    this.scene.tweens.add({
      targets: helpText,
      alpha: 1,
      ease: "Back.easeOut",
      duration: 2000,
      delay: 2000,
    });
  }
}
