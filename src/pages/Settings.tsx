import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Fade,
  InputAdornment,
  IconButton,
  Autocomplete,
} from '@mui/material';
import {
  Save as SaveIcon,
  Visibility as ShowIcon,
  VisibilityOff as HideIcon,
  CheckCircle as ValidIcon,
  Cancel as InvalidIcon,
  GitHub as GitHubIcon,
  SmartToy as AIIcon,
  Terminal as GitIcon,
  DeleteSweep as ClearIcon,
  FolderOpen as FolderIcon,
} from '@mui/icons-material';
import { open } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '../store';
import { setSetting, getAllSettings } from '../services/database';
import { validateToken, initOctokit } from '../services/github';
import { validateOpenAIKey } from '../services/llm';
import { isGitAvailable, getGitVersion } from '../services/git';
import type { ThemeMode } from '../types';

export default function Settings() {
  const { settings, setSettings, setUser, showNotification } = useAppStore();

  const [showToken, setShowToken] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [gitAvailable, setGitAvailable] = useState<boolean | null>(null);
  const [gitVersion, setGitVersion] = useState('');
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);

  const refreshGitStatus = useCallback(async (gitPath?: string) => {
    try {
      const available = await isGitAvailable(gitPath);
      setGitAvailable(available);

      if (available) {
        const version = await getGitVersion(gitPath);
        setGitVersion(version);
      } else {
        setGitVersion('');
      }

      return available;
    } catch {
      setGitAvailable(false);
      setGitVersion('');
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const all = await getAllSettings();
        const nextSettings = {
          githubToken: all.githubToken ?? '',
          openaiApiKey: all.openaiApiKey ?? '',
          openaiModel: all.openaiModel ?? 'gpt-4o',
          openaiBaseUrl: all.openaiBaseUrl ?? 'https://api.openai.com/v1',
          themeMode: (all.themeMode as ThemeMode) ?? 'system',
          gitPath: all.gitPath ?? '',
        };

        setSettings(nextSettings);

        if (all.githubToken) {
          const user = await validateToken(all.githubToken);
          if (user) {
            setTokenValid(true);
            setUser(user);
            initOctokit(all.githubToken);
          }
        }

        await refreshGitStatus(nextSettings.gitPath);
      } catch {
        await refreshGitStatus();
      }
    })();
  }, [refreshGitStatus, setSettings, setUser]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await setSetting('githubToken', settings.githubToken);
      await setSetting('openaiApiKey', settings.openaiApiKey);
      await setSetting('openaiModel', settings.openaiModel);
      await setSetting('openaiBaseUrl', settings.openaiBaseUrl);
      await setSetting('gitPath', settings.gitPath);

      const available = await refreshGitStatus(settings.gitPath);
      if (settings.gitPath.trim() && !available) {
        showNotification('设置已保存，但当前 Git 路径不可用', 'warning');
      } else {
        showNotification('设置已保存', 'success');
      }
    } catch (err) {
      showNotification(`保存失败: ${err}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [refreshGitStatus, settings, showNotification]);

  const handlePickGitExecutable = useCallback(async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        title: '选择 Git 可执行文件',
        filters: [{ name: 'Git Executable', extensions: ['exe'] }],
      });

      if (selected && typeof selected === 'string') {
        setSettings({ gitPath: selected });
        await refreshGitStatus(selected);
      }
    } catch (err) {
      showNotification(`选择 Git 失败: ${err}`, 'error');
    }
  }, [refreshGitStatus, setSettings, showNotification]);

  const handleValidateToken = useCallback(async () => {
    setValidating('token');
    try {
      const user = await validateToken(settings.githubToken);
      if (user) {
        setTokenValid(true);
        setUser(user);
        initOctokit(settings.githubToken);
        showNotification(`Token 验证成功，欢迎回来 ${user.name ?? user.login}`, 'success');
      } else {
        setTokenValid(false);
        showNotification('Token 无效，请检查后重试', 'error');
      }
    } catch {
      setTokenValid(false);
      showNotification('Token 验证失败', 'error');
    } finally {
      setValidating(null);
    }
  }, [settings.githubToken, setUser, showNotification]);

  const handleValidateApiKey = useCallback(async () => {
    setValidating('apikey');
    try {
      const valid = await validateOpenAIKey({
        apiKey: settings.openaiApiKey,
        model: settings.openaiModel,
        baseUrl: settings.openaiBaseUrl,
      });
      setApiKeyValid(valid);
      showNotification(valid ? 'API Key 验证成功' : 'API Key 无效', valid ? 'success' : 'error');
    } catch {
      setApiKeyValid(false);
      showNotification('API Key 验证失败', 'error');
    } finally {
      setValidating(null);
    }
  }, [settings, showNotification]);

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Fade in timeout={400}>
        <Box sx={{ maxWidth: 700 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
            <Typography variant="h5" fontWeight={700}>
              应用设置
            </Typography>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              保存设置
            </Button>
          </Stack>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <GitHubIcon />
                <Typography variant="h6" fontWeight={600}>
                  GitHub 配置
                </Typography>
                {tokenValid === true && <Chip label="已连接" size="small" color="success" icon={<ValidIcon />} />}
                {tokenValid === false && <Chip label="无效" size="small" color="error" icon={<InvalidIcon />} />}
              </Stack>

              <TextField
                fullWidth
                label="Personal Access Token"
                type={showToken ? 'text' : 'password'}
                value={settings.githubToken}
                onChange={(e) => setSettings({ githubToken: e.target.value })}
                size="small"
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowToken((v) => !v)} size="small">
                        {showToken ? <HideIcon /> : <ShowIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                helperText="需要 repo、read:user 等权限"
              />

              <Button
                variant="outlined"
                onClick={handleValidateToken}
                disabled={!settings.githubToken || validating === 'token'}
                size="small"
              >
                {validating === 'token' ? <CircularProgress size={18} /> : '验证 Token'}
              </Button>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <AIIcon />
                <Typography variant="h6" fontWeight={600}>
                  LLM 配置（OpenAI）
                </Typography>
                {apiKeyValid === true && <Chip label="已连接" size="small" color="success" icon={<ValidIcon />} />}
                {apiKeyValid === false && <Chip label="无效" size="small" color="error" icon={<InvalidIcon />} />}
              </Stack>

              <TextField
                fullWidth
                label="API Key"
                type={showApiKey ? 'text' : 'password'}
                value={settings.openaiApiKey}
                onChange={(e) => setSettings({ openaiApiKey: e.target.value })}
                size="small"
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowApiKey((v) => !v)} size="small">
                        {showApiKey ? <HideIcon /> : <ShowIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Base URL"
                value={settings.openaiBaseUrl}
                onChange={(e) => setSettings({ openaiBaseUrl: e.target.value })}
                size="small"
                sx={{ mb: 2 }}
                helperText="默认使用 https://api.openai.com/v1，也可以改成兼容 OpenAI 的接口地址"
              />

              <Autocomplete
                freeSolo
                options={['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']}
                value={settings.openaiModel}
                onInputChange={(_, value) => setSettings({ openaiModel: value })}
                size="small"
                sx={{ minWidth: 280, mb: 2 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="模型"
                    helperText="可以选择预设模型，也可以手动输入自定义模型名"
                  />
                )}
              />

              <Box>
                <Button
                  variant="outlined"
                  onClick={handleValidateApiKey}
                  disabled={!settings.openaiApiKey || validating === 'apikey'}
                  size="small"
                >
                  {validating === 'apikey' ? <CircularProgress size={18} /> : '验证 API Key'}
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <GitIcon />
                <Typography variant="h6" fontWeight={600}>
                  Git 配置
                </Typography>
                {gitAvailable === true && (
                  <Chip label="可用" size="small" color="success" icon={<ValidIcon />} />
                )}
                {gitAvailable === false && (
                  <Chip label="不可用" size="small" color="error" icon={<InvalidIcon />} />
                )}
              </Stack>

              {gitAvailable && gitVersion && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  版本：{gitVersion}
                </Typography>
              )}

              {gitAvailable === false && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  当前没有检测到可用的 Git。请确认路径指向有效的 <code>git.exe</code>，或者清空后改用系统 PATH 中的 Git。
                </Alert>
              )}

              <TextField
                fullWidth
                label="Git 可执行文件"
                value={settings.gitPath}
                onChange={(e) => setSettings({ gitPath: e.target.value })}
                size="small"
                placeholder="例如：C:\\Program Files\\Git\\cmd\\git.exe"
                helperText="这里配置 Git 软件的位置；仓库工作目录请在“偏好设置”里配置"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={handlePickGitExecutable}
                        size="small"
                        sx={{ color: 'primary.main' }}
                      >
                        <FolderIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                数据管理
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                所有数据都保存在本地 SQLite 数据库中，不会上传到任何第三方服务。
              </Typography>
              <Button
                variant="outlined"
                color="error"
                startIcon={<ClearIcon />}
                size="small"
                onClick={() => showNotification('清理缓存功能即将推出', 'info')}
              >
                清理搜索缓存
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Fade>
    </Box>
  );
}
