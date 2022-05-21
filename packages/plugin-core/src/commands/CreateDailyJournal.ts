import {
  ConfigUtils,
  DailyJournalTestGroups,
  DendronError,
  genUUID,
  JournalConfig,
  NoteUtils,
  SchemaCreationUtils,
  SchemaToken,
  SchemaUtils,
  VaultUtils,
  _2022_05_DAILY_JOURNAL_TEMPLATE_TEST,
} from "@dendronhq/common-all";
import { SegmentClient, vault2Path } from "@dendronhq/common-server";
import _ from "lodash";
import * as fs from "fs-extra";
import path from "path";
import * as vscode from "vscode";
import { PickerUtilsV2 } from "../components/lookup/utils";
import { DENDRON_COMMANDS } from "../constants";
import { IDendronExtension } from "../dendronExtensionInterface";
import { ExtensionProvider } from "../ExtensionProvider";
import { JournalNote } from "../traits/journal";
import {
  CommandOpts,
  CreateNoteWithTraitCommand,
  ExecuteData,
} from "./CreateNoteWithTraitCommand";
import { VSCodeUtils } from "../vsCodeUtils";

export class CreateDailyJournalCommand extends CreateNoteWithTraitCommand {
  static requireActiveWorkspace: boolean = true;
  public static DENDRON_TEMPLATES_FNAME: string = "dendron.templates";

  constructor(ext: IDendronExtension) {
    const workspaceService = ext.workspaceService;

    if (!workspaceService) {
      throw new DendronError({ message: "Workspace Service not initialized!" });
    }
    super(ext, "dendron.journal", new JournalNote(workspaceService.config));
    // override the key to maintain compatibility
    this.key = DENDRON_COMMANDS.CREATE_DAILY_JOURNAL_NOTE.key;
  }

  override async execute(opts: CommandOpts): Promise<ExecuteData> {
    const config = this._extension.getDWorkspace().config;
    const journalConfig = ConfigUtils.getJournal(config);
    const maybeDailyVault = journalConfig.dailyVault;
    const vault = maybeDailyVault
      ? VaultUtils.getVaultByName({
          vaults: this._extension.getEngine().vaults,
          vname: maybeDailyVault,
        })
      : undefined;
    let schemaCreated = false;
    let templateCreated = false;

    const ABUserGroup = _2022_05_DAILY_JOURNAL_TEMPLATE_TEST.getUserGroup(
      SegmentClient.instance().anonymousId
    );
    if (ABUserGroup === DailyJournalTestGroups.withTemplate) {
      // Check if a schema file exists, and if it doesn't, then create it first.
      schemaCreated = await this.makeSchemaFileIfNotExisting(journalConfig);
      // same with template file:
      templateCreated = await this.createTemplateFileIfNotExisting(
        journalConfig
      );
    }

    await super.execute({ ...opts, vaultOverride: vault });

    return { schemaCreated, templateCreated };
  }

  /**
   * Track whether new schema or template files were created
   */
  addAnalyticsPayload(_opts: CommandOpts, resp: ExecuteData) {
    return { resp };
  }

  /**
   * Create the pre-canned schema so that we can apply a template to the user's
   * meeting notes if the schema doesn't exist yet.
   *
   * @returns whether a new schema file was made
   */
  private async makeSchemaFileIfNotExisting(
    journalConfig: JournalConfig
  ): Promise<boolean> {
    const dailyDomain = journalConfig.dailyDomain;
    const maybeVault = journalConfig.dailyVault
      ? VaultUtils.getVaultByName({
          vaults: this._extension.getEngine().vaults,
          vname: journalConfig.dailyVault,
        })
      : undefined;
    const vaultPath = vault2Path({
      vault: maybeVault || PickerUtilsV2.getVaultForOpenEditor(),
      wsRoot: ExtensionProvider.getDWorkspace().wsRoot,
    });

    const uri = vscode.Uri.file(
      SchemaUtils.getPath({ root: vaultPath, fname: `dendron.${dailyDomain}` })
    );

    if (await fs.pathExists(uri.fsPath)) {
      return false;
    }

    const topLevel = {
      id: dailyDomain,
      title: dailyDomain,
      parent: "root",
      desc: "Identifier that will be used when using 'Lookup (Schema)' command.",
    };

    const tokenizedMatrix: SchemaToken[][] = [
      [
        { pattern: dailyDomain },
        {
          pattern: journalConfig.name,
          desc: "This pattern matches the 'journal' child hierarchy",
        },
        {
          pattern: "[0-2][0-9][0-9][0-9]",
          desc: "This pattern matches the YYYY (year) child hierarchy",
        },
        {
          pattern: "[0-1][0-9]",
          desc: "This pattern matches the MM (month) child hierarchy",
        },
        {
          pattern: "[0-3][0-9]",
          desc: "This pattern matches the DD (day) child hierarchy",
          template: {
            id:
              CreateDailyJournalCommand.DENDRON_TEMPLATES_FNAME +
              `.${dailyDomain}`,
            type: "note",
          },
        },
      ],
    ];

    const schemaJson = SchemaCreationUtils.getBodyForTokenizedMatrix({
      topLevel,
      tokenizedMatrix,
    });

    await fs.writeFile(uri.fsPath, schemaJson);

    await ExtensionProvider.getExtension().schemaSyncService.saveSchema({
      uri: uri!,
      isBrandNewFile: true,
    });

    return true;
  }

  /**
   * Create the pre-canned meeting template file in the user's workspace if it
   * doesn't exist yet.
   *
   * @returns whether a new template file was made
   */
  private async createTemplateFileIfNotExisting(
    journalConfig: JournalConfig
  ): Promise<boolean> {
    const fname =
      CreateDailyJournalCommand.DENDRON_TEMPLATES_FNAME +
      `.${journalConfig.dailyDomain}`;
    const fileName = fname + `.md`;

    const existingMeetingTemplates = NoteUtils.getNotesByFnameFromEngine({
      fname,
      engine: this._extension.getEngine(),
    });

    const maybeVault = journalConfig.dailyVault
      ? VaultUtils.getVaultByName({
          vaults: this._extension.getEngine().vaults,
          vname: journalConfig.dailyVault,
        })
      : undefined;
    const vault = maybeVault || PickerUtilsV2.getVaultForOpenEditor();
    const vaultPath = vault2Path({
      vault: PickerUtilsV2.getVaultForOpenEditor(),
      wsRoot: ExtensionProvider.getDWorkspace().wsRoot,
    });

    if (existingMeetingTemplates.length > 0) {
      return false;
    }

    const destfPath = path.join(vaultPath, fileName);

    // In addition to checking the engine on whether a note already exists,
    // check the file system path for the template file to ensure copying
    // succeeds
    if (await fs.pathExists(destfPath)) {
      return false;
    }

    const assetUri = VSCodeUtils.getAssetUri(this._extension.context);
    const dendronWSTemplate = VSCodeUtils.joinPath(assetUri, "dendron-ws");

    const src = path.join(dendronWSTemplate.fsPath, "templates", fileName);
    const body = (await fs.readFile(src)).toString();

    // Ensure that engine state is aware of the template before returning so
    // that the template can be found when creating the meeting note. TODO: This
    // is a bit fragile - make sure this ID matches what's in our built in
    // template
    const templateNoteProps = NoteUtils.create({
      fname,
      vault,
      id: genUUID(),
      title: "Daily Journal Template",
      body,
    });

    await this._extension.getEngine().writeNote(templateNoteProps);

    vscode.window.showInformationMessage(
      `Created template for your daily journal notes at ${fname}`
    );

    return true;
  }
}
