import {
  ABTest,
  ConfigUtils,
  DailyJournalTestGroups,
  DVault,
  _2022_05_DAILY_JOURNAL_TEMPLATE_TEST,
} from "@dendronhq/common-all";
import { NoteTestUtilsV4 } from "@dendronhq/common-test-utils";
import { ENGINE_HOOKS } from "@dendronhq/engine-test-utils";
import _ from "lodash";
import { beforeEach } from "mocha";
import sinon from "sinon";
import { CreateDailyJournalCommand } from "../../commands/CreateDailyJournal";
import { PickerUtilsV2 } from "../../components/lookup/utils";
import { CONFIG } from "../../constants";
import { ExtensionProvider } from "../../ExtensionProvider";
import { expect, getNoteFromTextEditor } from "../testUtilsv2";
import { describeMultiWS, EditorUtils } from "../testUtilsV3";

const stubVaultPick = (vaults: DVault[]) => {
  const vault = _.find(vaults, { fsPath: vaults[2].fsPath });
  sinon.stub(PickerUtilsV2, "promptVault").returns(Promise.resolve(vault));
  sinon
    .stub(PickerUtilsV2, "getOrPromptVaultForNewNote")
    .returns(Promise.resolve(vault));
  return vault;
};

suite("Create Daily Journal Suite", function () {
  const TEMPLATE_BODY = "test daily template";

  beforeEach(() => {
    sinon
      .stub(_2022_05_DAILY_JOURNAL_TEMPLATE_TEST, "getUserGroup")
      .returns(DailyJournalTestGroups.withTemplate!);
  });

  describeMultiWS(
    "GIVEN a basic workspace with a daily journal template note",
    {
      preSetupHook: ENGINE_HOOKS.setupBasic,
      preActivateHook: async ({ wsRoot, vaults }) => {
        await NoteTestUtilsV4.createNote({
          fname: CreateDailyJournalCommand.DENDRON_TEMPLATES_FNAME + ".daily",
          wsRoot,
          vault: vaults[0],
          body: TEMPLATE_BODY,
        });
      },
    },
    () => {
      test("WHEN CreateDailyJournalCommand is executed, then daily journal with template applied.", async () => {
        const ext = ExtensionProvider.getExtension();
        const cmd = new CreateDailyJournalCommand(ext);

        await cmd.run();
        const activeNote = getNoteFromTextEditor();
        // Verify template body is applied
        expect(activeNote.fname.startsWith("daily.journal")).toBeTruthy();
        expect(activeNote.body.includes(TEMPLATE_BODY)).toBeTruthy();

        // Verify trait is applied
        const traits = (activeNote as any).traitIds;
        expect(traits.length === 1 && traits[0] === "journalNote").toBeTruthy();

        // Verify schema is created
        const engine = ExtensionProvider.getEngine();
        const dailySchema = engine.schemas["daily"];
        expect(dailySchema.fname === "dendron.daily").toBeTruthy();
        expect(_.size(dailySchema.schemas) === 5).toBeTruthy();
      });
    }
  );

  describeMultiWS(
    "GIVEN a basic workspace with a daily journal template note and dailyVault set",
    {
      preSetupHook: ENGINE_HOOKS.setupBasic,
      preActivateHook: async ({ wsRoot, vaults }) => {
        await NoteTestUtilsV4.createNote({
          fname: CreateDailyJournalCommand.DENDRON_TEMPLATES_FNAME + ".daily",
          wsRoot,
          vault: vaults[0],
          body: TEMPLATE_BODY,
        });
      },
      modConfigCb: (config) => {
        ConfigUtils.setNoteLookupProps(config, "confirmVaultOnCreate", false);
        ConfigUtils.setJournalProps(config, "dailyVault", "vault2");
        return config;
      },
    },
    () => {
      test("WHEN CreateDailyJournalCommand is executed, then daily journal is created in daily vault with template applied.", async () => {
        const ext = ExtensionProvider.getExtension();
        const cmd = new CreateDailyJournalCommand(ext);

        await cmd.run();
        const activeNote = getNoteFromTextEditor();
        // Verify template body is applied
        expect(activeNote.fname.startsWith("daily.journal")).toBeTruthy();
        expect(activeNote.body.includes(TEMPLATE_BODY)).toBeTruthy();

        // Verify trait is applied
        const traits = (activeNote as any).traitIds;
        expect(traits.length === 1 && traits[0] === "journalNote").toBeTruthy();

        // Verify schema is created
        const engine = ExtensionProvider.getEngine();
        const dailySchema = engine.schemas["daily"];
        expect(dailySchema.fname === "dendron.daily").toBeTruthy();
        expect(_.size(dailySchema.schemas) === 5).toBeTruthy();

        expect(
          (await EditorUtils.getURIForActiveEditor()).fsPath.includes(
            engine.vaults[1].fsPath
          )
        ).toBeTruthy();
      });
    }
  );

  describeMultiWS(
    "GIVEN a basic workspace with a daily journal template note and dailyVault set with lookup Confirm",
    {
      preSetupHook: ENGINE_HOOKS.setupBasic,
      preActivateHook: async ({ wsRoot, vaults }) => {
        await NoteTestUtilsV4.createNote({
          fname: CreateDailyJournalCommand.DENDRON_TEMPLATES_FNAME + ".daily",
          wsRoot,
          vault: vaults[0],
          body: TEMPLATE_BODY,
        });
      },
      modConfigCb: (config) => {
        ConfigUtils.setNoteLookupProps(config, "confirmVaultOnCreate", true);
        ConfigUtils.setJournalProps(config, "dailyVault", "vault1");
        return config;
      },
    },
    () => {
      test("WHEN CreateDailyJournalCommand is executed, then daily journal is created in daily vault with template is applied.", async () => {
        const ext = ExtensionProvider.getExtension();
        const cmd = new CreateDailyJournalCommand(ext);

        await cmd.run();
        const activeNote = getNoteFromTextEditor();
        // Verify template body is applied
        expect(activeNote.fname.startsWith("daily.journal")).toBeTruthy();
        expect(activeNote.body.includes(TEMPLATE_BODY)).toBeTruthy();

        // Verify trait is applied
        const traits = (activeNote as any).traitIds;
        expect(traits.length === 1 && traits[0] === "journalNote").toBeTruthy();

        // Verify schema is created
        const engine = ExtensionProvider.getEngine();
        const dailySchema = engine.schemas["daily"];
        expect(dailySchema.fname === "dendron.daily").toBeTruthy();
        expect(_.size(dailySchema.schemas) === 5).toBeTruthy();

        expect(
          (await EditorUtils.getURIForActiveEditor()).fsPath.includes(
            engine.vaults[0].fsPath
          )
        ).toBeTruthy();
      });
    }
  );

  describeMultiWS(
    "GIVEN a basic workspace with a daily journal template note and dailyVault not set with lookup Confirm",
    {
      preSetupHook: ENGINE_HOOKS.setupBasic,
      preActivateHook: async ({ wsRoot, vaults }) => {
        await NoteTestUtilsV4.createNote({
          fname: CreateDailyJournalCommand.DENDRON_TEMPLATES_FNAME + ".daily",
          wsRoot,
          vault: vaults[0],
          body: TEMPLATE_BODY,
        });
      },
      modConfigCb: (config) => {
        ConfigUtils.setNoteLookupProps(config, "confirmVaultOnCreate", true);
        return config;
      },
    },
    () => {
      test("WHEN CreateDailyJournalCommand is executed, then daily journal is created in daily vault with template applied.", async () => {
        const ext = ExtensionProvider.getExtension();
        const { vaults, engine } = ExtensionProvider.getDWorkspace();
        stubVaultPick(vaults);
        const cmd = new CreateDailyJournalCommand(ext);

        await cmd.run();
        const activeNote = getNoteFromTextEditor();
        // Verify template body is applied
        expect(activeNote.fname.startsWith("daily.journal")).toBeTruthy();
        expect(activeNote.body.includes(TEMPLATE_BODY)).toBeTruthy();

        // Verify trait is applied
        const traits = (activeNote as any).traitIds;
        expect(traits.length === 1 && traits[0] === "journalNote").toBeTruthy();

        // Verify schema is created
        const dailySchema = engine.schemas["daily"];
        expect(dailySchema.fname === "dendron.daily").toBeTruthy();
        expect(_.size(dailySchema.schemas) === 5).toBeTruthy();

        expect(
          (await EditorUtils.getURIForActiveEditor()).fsPath.includes(
            engine.vaults[2].fsPath
          )
        ).toBeTruthy();
      });
    }
  );

  describeMultiWS(
    "GIVEN a basic workspace with a daily journal template note and dailyDomain set",
    {
      preSetupHook: ENGINE_HOOKS.setupBasic,
      preActivateHook: async ({ wsRoot, vaults }) => {
        await NoteTestUtilsV4.createNote({
          fname: CreateDailyJournalCommand.DENDRON_TEMPLATES_FNAME + ".bar",
          wsRoot,
          vault: vaults[0],
          body: TEMPLATE_BODY,
        });
      },
      modConfigCb: (config) => {
        ConfigUtils.setJournalProps(config, "dailyDomain", "bar");
        return config;
      },
    },
    () => {
      test("WHEN CreateDailyJournalCommand is executed, then daily journal is created with right domain and with template applied.", async () => {
        const ext = ExtensionProvider.getExtension();
        const cmd = new CreateDailyJournalCommand(ext);

        await cmd.run();
        const activeNote = getNoteFromTextEditor();
        // Verify template body is applied
        expect(activeNote.fname.startsWith("bar.journal")).toBeTruthy();
        expect(activeNote.body.includes(TEMPLATE_BODY)).toBeTruthy();

        // Verify trait is applied
        const traits = (activeNote as any).traitIds;
        expect(traits.length === 1 && traits[0] === "journalNote").toBeTruthy();

        // Verify schema is created
        const engine = ExtensionProvider.getEngine();
        const dailySchema = engine.schemas["bar"];
        expect(dailySchema.fname === "dendron.bar").toBeTruthy();
        expect(_.size(dailySchema.schemas) === 5).toBeTruthy();
      });
    }
  );

  describeMultiWS(
    "GIVEN a basic workspace with a daily journal template note and deprecated config",
    {
      preSetupHook: ENGINE_HOOKS.setupBasic,
      preActivateHook: async ({ wsRoot, vaults }) => {
        await NoteTestUtilsV4.createNote({
          fname: CreateDailyJournalCommand.DENDRON_TEMPLATES_FNAME + ".daisy",
          wsRoot,
          vault: vaults[0],
          body: TEMPLATE_BODY,
        });
      },
      wsSettingsOverride: {
        settings: {
          [CONFIG.DEFAULT_JOURNAL_DATE_FORMAT.key]: "'q'q",
          [CONFIG.DEFAULT_JOURNAL_ADD_BEHAVIOR.key]: "childOfCurrent",
          [CONFIG.DAILY_JOURNAL_DOMAIN.key]: "daisy",
          [CONFIG.DEFAULT_JOURNAL_NAME.key]: "journey",
        },
      },
      modConfigCb: (config) => {
        ConfigUtils.setJournalProps(config, "dateFormat", "dd");
        ConfigUtils.setJournalProps(config, "dailyDomain", "daisy");
        ConfigUtils.setJournalProps(config, "name", "journey");
        return config;
      },
    },
    () => {
      test("WHEN CreateDailyJournalCommand is executed, then deprecated config is ignored.", async () => {
        const ext = ExtensionProvider.getExtension();
        const cmd = new CreateDailyJournalCommand(ext);

        await cmd.run();
        const activeNote = getNoteFromTextEditor();
        // Verify template body is applied
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, "0");
        expect(activeNote.fname).toEqual(`daisy.journey.${dd}`);
        // TODO: Enable when/if we support applying templates to journals with configured dateFormat
        //expect(activeNote.body.includes(TEMPLATE_BODY)).toBeTruthy();

        // Verify trait is applied
        const traits = (activeNote as any).traitIds;
        expect(traits.length === 1 && traits[0] === "journalNote").toBeTruthy();

        // Verify schema is created
        const engine = ExtensionProvider.getEngine();
        const dailySchema = engine.schemas["daisy"];
        expect(dailySchema.fname === "dendron.daisy").toBeTruthy();
        expect(_.size(dailySchema.schemas) === 5).toBeTruthy();
      });
    }
  );

  describeMultiWS(
    "GIVEN a basic workspace with a daily journal template note",
    {
      preSetupHook: ENGINE_HOOKS.setupBasic,
      preActivateHook: async ({ wsRoot, vaults }) => {
        await NoteTestUtilsV4.createNote({
          fname: CreateDailyJournalCommand.DENDRON_TEMPLATES_FNAME + ".daily",
          wsRoot,
          vault: vaults[0],
          body: TEMPLATE_BODY,
        });
      },
    },
    () => {
      test("WHEN CreateDailyJournalCommand is executed multiple times, then template and schema are not generated again", async () => {
        const ext = ExtensionProvider.getExtension();
        const cmd = new CreateDailyJournalCommand(ext);

        await cmd.run();
        const activeNote = getNoteFromTextEditor();
        // Verify template body is applied
        expect(activeNote.fname.startsWith("daily.journal")).toBeTruthy();
        expect(activeNote.body.includes(TEMPLATE_BODY)).toBeTruthy();

        // Verify trait is applied
        const traits = (activeNote as any).traitIds;
        expect(traits.length === 1 && traits[0] === "journalNote").toBeTruthy();

        // Verify schema is created
        const engine = ExtensionProvider.getEngine();
        const dailySchema = engine.schemas["daily"];
        expect(dailySchema.fname === "dendron.daily").toBeTruthy();
        expect(_.size(dailySchema.schemas) === 5).toBeTruthy();
        const numNotesBefore = _.size(engine.notes);
        const numSchemasBefore = _.size(engine.schemas);
        await cmd.run();
        expect(numNotesBefore).toEqual(_.size(engine.notes));
        expect(numSchemasBefore).toEqual(_.size(engine.schemas));
      });
    }
  );
});
