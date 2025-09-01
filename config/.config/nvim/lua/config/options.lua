-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here
vim.opt.wrap = true -- Enable soft wrap globally
vim.opt.linebreak = true -- Break at word boundaries instead of mid-word

-- Disable relative line numbers
vim.opt.relativenumber = false

-- Disable LSP inlay hints
vim.api.nvim_create_autocmd("LspAttach", {
  group = vim.api.nvim_create_augroup("DisableInlayHints", {}),
  callback = function(args)
    local client = vim.lsp.get_client_by_id(args.data.client_id)
    if client and client.supports_method("textDocument/inlayHint") then
      vim.lsp.inlay_hint.enable(false, { bufnr = args.buf })
    end
  end,
})

-- Keep buffer settings for new buffers
vim.opt.hidden = true -- Allow switching buffers without saving
vim.opt.autoread = true -- Automatically read files that have been changed outside of vim
vim.opt.updatetime = 300 -- Faster completion and swap file writing

-- Preserve certain settings across buffers
vim.api.nvim_create_autocmd("BufEnter", {
  group = vim.api.nvim_create_augroup("PreserveBufferSettings", {}),
  callback = function()
    -- Keep the same cursor column position when switching buffers
    vim.opt.virtualedit = "onemore"
    -- Preserve undo history across buffer switches
    vim.opt.undofile = true
    -- Keep the same view (folds, cursor position) when re-entering buffers
    vim.cmd("silent! loadview")
  end,
})

-- Save view when leaving buffer
vim.api.nvim_create_autocmd("BufLeave", {
  group = vim.api.nvim_create_augroup("SaveBufferView", {}),
  callback = function()
    vim.cmd("silent! mkview")
  end,
})
