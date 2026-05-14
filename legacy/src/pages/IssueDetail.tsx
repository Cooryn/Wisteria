import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fade,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import {
  ArrowBack as BackIcon,
  AutoAwesome as AIIcon,
  Bookmark as BookmarkIcon,
  CallSplit as DraftPRIcon,
  FolderOpen as FolderIcon,
  OpenInNew as OpenIcon,
  PlayArrow as StartIcon,
  Schedule as TimeIcon,
  Speed as DifficultyIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAppStore } from '../store';
import {
  createDraftPRFromSession,
  getContributionErrorMessage,
  startContribution,
} from '../services/contribution';
import {
  getContributionSessionByIssueGitHubId,
  getSavedIssueByGitHubId,
  saveIssue,
} from '../services/database';
import { analyzeIssue } from '../services/llm';
import type { ContributionProgressStep, ContributionSession, IssueAnalysis } from '../types';

function parseSavedAnalysis(value: string | null): IssueAnalysis | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as IssueAnalysis;
  } catch {
    return null;
  }
}

function upsertProgressStep(
  prev: ContributionProgressStep[],
  nextStep: ContributionProgressStep
): ContributionProgressStep[] {
  const existingIndex = prev.findIndex((step) => step.key === nextStep.key);
  if (existingIndex === -1) {
    return [...prev, nextStep];
  }

  const next = [...prev];
  next[existingIndex] = {
    ...next[existingIndex],
    ...nextStep,
  };
  return next;
}

type ContributionDialogState = {
  open: boolean;
  title: string;
  busy: boolean;
  error: string | null;
  successMessage: string | null;
  steps: ContributionProgressStep[];
  localRepoPath: string | null;
  branchName: string | null;
  prUrl: string | null;
};

const INITIAL_DIALOG_STATE: ContributionDialogState = {
  open: false,
  title: '',
  busy: false,
  error: null,
  successMessage: null,
  steps: [],
  localRepoPath: null,
  branchName: null,
  prUrl: null,
};

export default function IssueDetail() {
  const { selectedIssue, issueDetailBackPage, setCurrentPage, settings, showNotification } = useAppStore();

  const [analysis, setAnalysis] = useState<IssueAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [contributionSession, setContributionSession] = useState<ContributionSession | null>(null);
  const [dialogState, setDialogState] = useState<ContributionDialogState>(INITIAL_DIALOG_STATE);

  const handleBack = () => setCurrentPage(issueDetailBackPage);

  useEffect(() => {
    let isActive = true;

    setSaved(false);
    setAnalysis(null);
    setContributionSession(null);

    if (!selectedIssue) {
      return () => {
        isActive = false;
      };
    }

    const loadIssueState = async () => {
      const [savedIssue, session] = await Promise.all([
        getSavedIssueByGitHubId(selectedIssue.id),
        getContributionSessionByIssueGitHubId(selectedIssue.id),
      ]);

      if (!isActive) {
        return;
      }

      if (savedIssue) {
        setSaved(true);
        const parsed = parseSavedAnalysis(savedIssue.analysis);
        if (parsed) {
          setAnalysis(parsed);
        }
      }

      setContributionSession(session);
    };

    void loadIssueState();

    return () => {
      isActive = false;
    };
  }, [selectedIssue]);

  const handleAnalyze = useCallback(async () => {
    if (!selectedIssue) {
      return;
    }

    if (!settings.openaiApiKey) {
      showNotification('请先在设置中配置 OpenAI API Key', 'warning');
      return;
    }

    setAnalyzing(true);
    try {
      const result = await analyzeIssue(
        {
          apiKey: settings.openaiApiKey,
          model: settings.openaiModel,
          baseUrl: settings.openaiBaseUrl,
        },
        selectedIssue
      );
      setAnalysis(result);
    } catch (err) {
      showNotification(`分析失败: ${err}`, 'error');
    } finally {
      setAnalyzing(false);
    }
  }, [selectedIssue, settings, showNotification]);

  const handleSave = useCallback(async () => {
    if (!selectedIssue || saved) {
      return;
    }

    try {
      await saveIssue({
        id: 0,
        github_id: selectedIssue.id,
        repo_full_name: selectedIssue.repo_full_name ?? '',
        issue_number: selectedIssue.number,
        title: selectedIssue.title,
        body: selectedIssue.body,
        labels: JSON.stringify(selectedIssue.labels),
        state: selectedIssue.state,
        html_url: selectedIssue.html_url,
        comments: selectedIssue.comments,
        user_login: selectedIssue.user.login,
        user_avatar_url: selectedIssue.user.avatar_url,
        created_at: selectedIssue.created_at,
        updated_at: selectedIssue.updated_at,
        score: null,
        analysis: analysis ? JSON.stringify(analysis) : null,
        saved_at: new Date().toISOString(),
      });
      setSaved(true);
      showNotification('Issue 已收藏', 'success');
    } catch (err) {
      showNotification(`收藏失败: ${err}`, 'error');
    }
  }, [analysis, saved, selectedIssue, showNotification]);

  const handleOpenIssue = useCallback(async () => {
    if (!selectedIssue?.html_url) {
      return;
    }

    try {
      await openUrl(selectedIssue.html_url);
    } catch (err) {
      showNotification(`打开 GitHub Issue 失败: ${err}`, 'error');
    }
  }, [selectedIssue, showNotification]);

  const handleOpenLocalRepo = useCallback(
    async (repoPath?: string | null) => {
      const path = repoPath ?? contributionSession?.local_repo_path;
      if (!path) {
        return;
      }

      try {
        await revealItemInDir(path);
      } catch (err) {
        showNotification(`打开本地目录失败: ${err}`, 'error');
      }
    },
    [contributionSession?.local_repo_path, showNotification]
  );

  const handleOpenDraftPR = useCallback(async () => {
    if (!contributionSession?.pr_url) {
      return;
    }

    try {
      await openUrl(contributionSession.pr_url);
    } catch (err) {
      showNotification(`打开 Draft PR 失败: ${err}`, 'error');
    }
  }, [contributionSession?.pr_url, showNotification]);

  const handleOpenDraftPRUrl = useCallback(
    async (prUrl?: string | null) => {
      if (!prUrl) {
        return;
      }

      try {
        await openUrl(prUrl);
      } catch (err) {
        showNotification(`打开 Draft PR 失败: ${err}`, 'error');
      }
    },
    [showNotification]
  );

  const resetDialog = useCallback((title: string) => {
    setDialogState({
      ...INITIAL_DIALOG_STATE,
      open: true,
      title,
      busy: true,
    });
  }, []);

  const updateDialogStep = useCallback((step: ContributionProgressStep) => {
    setDialogState((prev) => ({
      ...prev,
      steps: upsertProgressStep(prev.steps, step),
    }));
  }, []);

  const handleCloseDialog = useCallback(() => {
    if (dialogState.busy) {
      return;
    }

    setDialogState(INITIAL_DIALOG_STATE);
  }, [dialogState.busy]);

  const handleStartContribution = useCallback(async () => {
    if (!selectedIssue) {
      return;
    }

    resetDialog('开始贡献');

    try {
      const result = await startContribution(selectedIssue, updateDialogStep);
      setContributionSession(result.session);
      setDialogState((prev) => ({
        ...prev,
        busy: false,
        error: null,
        successMessage: '本地仓库与贡献分支已准备完成。',
        localRepoPath: result.localRepoPath,
        branchName: result.branchName,
      }));
      showNotification('开始贡献准备完成', 'success');
    } catch (err) {
      setDialogState((prev) => ({
        ...prev,
        busy: false,
        error: getContributionErrorMessage(err),
      }));
      showNotification(getContributionErrorMessage(err), 'error');
    }
  }, [resetDialog, selectedIssue, showNotification, updateDialogStep]);

  const handleCreateDraftPR = useCallback(async () => {
    if (!selectedIssue) {
      return;
    }

    resetDialog('起草 Draft PR');

    try {
      const result = await createDraftPRFromSession(selectedIssue, analysis, updateDialogStep);
      setContributionSession(result.session);
      setDialogState((prev) => ({
        ...prev,
        busy: false,
        error: null,
        successMessage: result.reusedExisting
          ? '已复用现有的开放 PR。'
          : 'Draft PR 已创建成功。',
        localRepoPath: result.session.local_repo_path,
        branchName: result.session.branch_name,
        prUrl: result.prUrl,
      }));
      showNotification(result.reusedExisting ? '已复用现有 Draft PR' : 'Draft PR 创建成功', 'success');
    } catch (err) {
      setDialogState((prev) => ({
        ...prev,
        busy: false,
        error: getContributionErrorMessage(err),
      }));
      showNotification(getContributionErrorMessage(err), 'error');
    }
  }, [analysis, resetDialog, selectedIssue, showNotification, updateDialogStep]);

  const contributionSummary = useMemo(() => {
    if (!contributionSession) {
      return null;
    }

    return (
      <Alert
        severity={contributionSession.status === 'draft_created' ? 'success' : 'info'}
        sx={{ mb: 3, alignItems: 'flex-start' }}
      >
        <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
          {contributionSession.status === 'draft_created' ? 'Draft PR 已准备好' : '本地贡献环境已准备好'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          分支：<strong>{contributionSession.branch_name}</strong>
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}
        >
          路径：{contributionSession.local_repo_path}
        </Typography>
      </Alert>
    );
  }, [contributionSession]);

  if (!selectedIssue) {
    return (
      <Box sx={{ p: 3 }}>
        <Button startIcon={<BackIcon />} onClick={handleBack}>
          返回
        </Button>
        <Typography sx={{ mt: 4, textAlign: 'center' }}>当前没有选中的 Issue</Typography>
      </Box>
    );
  }

  const difficultyColors = {
    easy: '#66BB6A',
    medium: '#FFA726',
    hard: '#EF5350',
  };

  const difficultyLabels = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  };

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Fade in timeout={400}>
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
            <Button startIcon={<BackIcon />} onClick={handleBack}>
              返回
            </Button>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="outlined"
                startIcon={<BookmarkIcon />}
                onClick={handleSave}
                disabled={saved}
                color={saved ? 'success' : 'primary'}
              >
                {saved ? '已收藏' : '收藏'}
              </Button>
              <Button variant="outlined" startIcon={<AIIcon />} onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? <CircularProgress size={18} /> : 'AI 分析'}
              </Button>

              {!contributionSession && (
                <Button variant="contained" startIcon={<StartIcon />} onClick={handleStartContribution}>
                  开始贡献
                </Button>
              )}

              {contributionSession?.status === 'ready' && (
                <>
                  <Button variant="contained" startIcon={<FolderIcon />} onClick={() => handleOpenLocalRepo()}>
                    继续贡献
                  </Button>
                  <Button variant="outlined" startIcon={<DraftPRIcon />} onClick={handleCreateDraftPR}>
                    起草 Draft PR
                  </Button>
                </>
              )}

              {contributionSession?.status === 'draft_created' && (
                <>
                  <Button variant="outlined" startIcon={<FolderIcon />} onClick={() => handleOpenLocalRepo()}>
                    打开本地目录
                  </Button>
                  <Button variant="contained" startIcon={<DraftPRIcon />} onClick={handleOpenDraftPR}>
                    打开 Draft PR
                  </Button>
                </>
              )}
            </Stack>
          </Stack>

          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                #{selectedIssue.number} {selectedIssue.title}
              </Typography>

              {selectedIssue.repo_full_name && (
                <Typography variant="body2" color="text.secondary">
                  {selectedIssue.repo_full_name}
                </Typography>
              )}

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {selectedIssue.labels.map((label) => (
                  <Chip
                    key={`${label.id}-${label.name}`}
                    label={label.name}
                    size="small"
                    sx={{
                      backgroundColor: `#${label.color}22`,
                      color: `#${label.color}`,
                      border: `1px solid #${label.color}44`,
                      fontWeight: 500,
                    }}
                  />
                ))}
              </Stack>

              <Stack
                direction="row"
                spacing={3}
                useFlexGap
                sx={{ flexWrap: 'wrap', color: 'text.secondary', alignItems: 'center' }}
              >
                <Typography variant="caption">
                  状态: <strong>{selectedIssue.state}</strong>
                </Typography>
                <Typography variant="caption">
                  评论: <strong>{selectedIssue.comments}</strong>
                </Typography>
                <Typography variant="caption">
                  作者: <strong>{selectedIssue.user.login}</strong>
                </Typography>
                {selectedIssue.html_url && (
                  <IconButton
                    size="small"
                    aria-label="open issue on github"
                    onClick={handleOpenIssue}
                    sx={{
                      ml: 'auto',
                      mt: -0.5,
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      borderRadius: 2,
                    }}
                  >
                    <OpenIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            </CardContent>
          </Card>

          {contributionSummary}

          <Box sx={{ display: 'flex', gap: 3 }}>
            <Card sx={{ flex: 1, minWidth: 0 }}>
              <CardContent sx={{ px: { xs: 2.5, md: 3 }, py: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Issue 内容
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box
                  sx={{
                    px: { xs: 0.5, md: 1.5 },
                    minWidth: 0,
                    overflow: 'hidden',
                    '& img': { maxWidth: '100%', borderRadius: 1 },
                    '& code': {
                      backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
                      px: 0.5,
                      py: 0.25,
                      borderRadius: 0.5,
                      fontSize: '0.85em',
                      fontFamily: 'monospace',
                    },
                    '& pre': {
                      backgroundColor: (theme) => alpha(theme.palette.background.default, 0.8),
                      p: 2,
                      borderRadius: 2,
                      maxWidth: '100%',
                      overflow: 'auto',
                      '& code': {
                        backgroundColor: 'transparent',
                        p: 0,
                      },
                    },
                    '& a': { color: 'primary.main' },
                    '& blockquote': {
                      borderLeft: (theme) => `3px solid ${theme.palette.primary.main}`,
                      pl: 2,
                      ml: 0,
                      opacity: 0.8,
                    },
                    '& table': {
                      display: 'block',
                      width: '100%',
                      maxWidth: '100%',
                      overflowX: 'auto',
                      borderCollapse: 'collapse',
                    },
                    '& p, & li, & td, & th': {
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    },
                    '& ul, & ol': {
                      pl: 3,
                      pr: 1,
                    },
                    '& > *:first-of-type': {
                      mt: 0,
                    },
                    '& > *:last-child': {
                      mb: 0,
                    },
                  }}
                >
                  {selectedIssue.body ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedIssue.body}</ReactMarkdown>
                  ) : (
                    <Typography color="text.secondary" fontStyle="italic">
                      暂无描述
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>

            <Box sx={{ width: 320, flexShrink: 0 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    <AIIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                    AI 分析
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  {analyzing && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  )}

                  {!analysis && !analyzing && (
                    <Box sx={{ textAlign: 'center', py: 3, opacity: 0.5 }}>
                      <AIIcon sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="body2">点击“AI 分析”获取建议</Typography>
                      <Typography variant="caption" color="text.secondary">
                        这里会评估难度、时间预估和建议做法
                      </Typography>
                    </Box>
                  )}

                  {analysis && (
                    <Fade in timeout={500}>
                      <Box>
                        <Box sx={{ mb: 2 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                            <DifficultyIcon
                              sx={{ fontSize: 18, color: difficultyColors[analysis.difficulty] }}
                            />
                            <Typography variant="subtitle2">难度评估</Typography>
                          </Stack>
                          <Chip
                            label={difficultyLabels[analysis.difficulty]}
                            size="small"
                            sx={{
                              backgroundColor: alpha(difficultyColors[analysis.difficulty], 0.15),
                              color: difficultyColors[analysis.difficulty],
                              fontWeight: 600,
                            }}
                          />
                        </Box>

                        <Box sx={{ mb: 2 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                            <TimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="subtitle2">预计时间</Typography>
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {analysis.estimatedTime}
                          </Typography>
                        </Box>

                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            建议方向
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                            {analysis.suggestedApproach}
                          </Typography>
                        </Box>

                        {analysis.relatedFiles.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              可能涉及文件
                            </Typography>
                            <Stack spacing={0.5}>
                              {analysis.relatedFiles.map((file) => (
                                <Typography
                                  key={file}
                                  variant="caption"
                                  sx={{
                                    fontFamily: 'monospace',
                                    backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.06),
                                    px: 1,
                                    py: 0.5,
                                    borderRadius: 1,
                                  }}
                                >
                                  {file}
                                </Typography>
                              ))}
                            </Stack>
                          </Box>
                        )}

                        {analysis.tags.length > 0 && (
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              相关技术
                            </Typography>
                            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                              {analysis.tags.map((tag) => (
                                <Chip key={tag} label={tag} size="small" variant="outlined" />
                              ))}
                            </Stack>
                          </Box>
                        )}
                      </Box>
                    </Fade>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>
      </Fade>

      <Dialog open={dialogState.open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogState.title}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {dialogState.busy && (
              <Alert severity="info" icon={<CircularProgress size={18} />}>
                正在执行贡献流程，请稍候…
              </Alert>
            )}

            {dialogState.error && <Alert severity="error">{dialogState.error}</Alert>}
            {dialogState.successMessage && <Alert severity="success">{dialogState.successMessage}</Alert>}

            {dialogState.steps.length > 0 && (
              <List dense sx={{ px: 0 }}>
                {dialogState.steps.map((step) => (
                  <ListItem
                    key={step.key}
                    disableGutters
                    sx={{
                      px: 0,
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        minWidth: 0,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 1.5,
                      }}
                    >
                      <ListItemText
                        primary={step.label}
                        secondary={step.detail}
                        sx={{
                          my: 0,
                          minWidth: 0,
                          '& .MuiListItemText-secondary': {
                            overflowWrap: 'anywhere',
                          },
                        }}
                      />
                      <Chip
                        size="small"
                        sx={{ flexShrink: 0, alignSelf: 'flex-start' }}
                        color={
                          step.status === 'success'
                            ? 'success'
                            : step.status === 'error'
                              ? 'error'
                              : step.status === 'running'
                                ? 'primary'
                                : 'default'
                        }
                        label={
                          step.status === 'success'
                            ? '完成'
                            : step.status === 'error'
                              ? '失败'
                              : step.status === 'running'
                                ? '进行中'
                                : '等待中'
                        }
                      />
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}

            {(dialogState.localRepoPath || dialogState.branchName || dialogState.prUrl) && (
              <Card variant="outlined">
                <CardContent>
                  {dialogState.branchName && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      分支：<strong>{dialogState.branchName}</strong>
                    </Typography>
                  )}
                  {dialogState.localRepoPath && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}
                    >
                      路径：{dialogState.localRepoPath}
                    </Typography>
                  )}
                  {dialogState.prUrl && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1, fontFamily: 'monospace', overflowWrap: 'anywhere' }}
                    >
                      PR：{dialogState.prUrl}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={dialogState.busy}>
            关闭
          </Button>
          {dialogState.localRepoPath && (
            <Button
              onClick={() => handleOpenLocalRepo(dialogState.localRepoPath)}
              disabled={dialogState.busy}
              startIcon={<FolderIcon />}
            >
              打开本地目录
            </Button>
          )}
          {dialogState.prUrl && (
            <Button
              onClick={() => void handleOpenDraftPRUrl(dialogState.prUrl)}
              disabled={dialogState.busy}
              variant="contained"
              startIcon={<DraftPRIcon />}
            >
              打开 Draft PR
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
